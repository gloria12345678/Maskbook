/// <reference path="./global.d.ts" />
/**
 * Database structure:
 *
 * # ObjectStore `people`:
 * @description Store Other people.
 * @type {PersonRecordInDatabase}
 * @keys inline, {@link PersonIdentifier.identifier}
 * @index network
 *
 * # ObjectStore `myself`:
 * @description Store my identities.
 * @type {PersonRecordInDatabase}
 * @keys inline, {@link PersonIdentifier.identifier}
 *
 * # ObjectStore `localKeys`:
 * @description Store local AES keys.
 * @type {Record<string, CryptoKey>} Record of <userId, CryptoKey>
 * @keys outline, string, which means network.
 */
import { GroupIdentifier, Identifier, PersonIdentifier } from './type'
import { DBSchema, openDB } from 'idb/with-async-ittr'
import { CryptoKeyToJsonWebKey, JsonWebKeyToCryptoKey } from '../utils/type-transform/CryptoKey-JsonWebKey'
import { MessageCenter } from '../utils/messages'
import { personRecordToPerson } from './helpers/person'
import { isIdentifierArrayEquals } from '../utils/equality'
import { createDefaultFriendsGroup } from './helpers/group'
import { generate_AES_GCM_256_Key, generate_ECDH_256k1_KeyPair } from '../utils/crypto.subtle'

//#region Type and utils
/**
 * Transform data out of database
 */
async function outDb({ identifier, publicKey, privateKey, ...rest }: PersonRecordInDatabase): Promise<PersonRecord> {
    // Restore prototype
    rest.previousIdentifiers &&
        rest.previousIdentifiers.forEach(y => Object.setPrototypeOf(y, PersonIdentifier.prototype))
    rest.groups.forEach(y => Object.setPrototypeOf(y, GroupIdentifier.prototype))
    const result: PersonRecord = {
        ...rest,
        identifier: Identifier.fromString(identifier) as PersonIdentifier,
    }
    if (publicKey) result.publicKey = await JsonWebKeyToCryptoKey(publicKey)
    if (privateKey) result.privateKey = await JsonWebKeyToCryptoKey(privateKey)
    return result
}
/**
 * Transform outside data into db format
 */
async function toDb({ publicKey, privateKey, ...rest }: PersonRecord): Promise<PersonRecordInDatabase> {
    const result: PersonRecordInDatabase = {
        ...rest,
        identifier: rest.identifier.toText(),
        network: rest.identifier.network,
    }
    if (publicKey) result.publicKey = await CryptoKeyToJsonWebKey(publicKey)
    if (privateKey) result.privateKey = await CryptoKeyToJsonWebKey(privateKey)
    return result
}
interface Base<db> {
    identifier: IF<db, string, PersonIdentifier>
    publicKey?: IF<db, JsonWebKey, CryptoKey>
    privateKey?: IF<db, JsonWebKey, CryptoKey>
}
export interface PersonRecord extends Omit<PersonRecordInDatabase, keyof Base<true> | 'network'>, Base<false> {}
export type PersonRecordPublic = PersonRecord & Required<Pick<PersonRecord, 'publicKey'>>
export function isPersonRecordPublic(data: PersonRecord): data is PersonRecordPublic {
    return 'publicKey' in data
}
export type PersonRecordPublicPrivate = PersonRecord & Required<Pick<PersonRecord, 'publicKey' | 'privateKey'>>
export function isPersonRecordPublicPrivate(data: PersonRecord): data is PersonRecordPublicPrivate {
    return 'publicKey' in data && 'privateKey' in data
}
interface PersonRecordInDatabase extends Base<true> {
    network: string
    previousIdentifiers?: PersonIdentifier[]
    nickname?: string
    groups: GroupIdentifier[]
}
type LocalKeys = Record<string, CryptoKey | undefined>
interface PeopleDB extends DBSchema {
    /** Use inline keys */
    people: {
        value: PersonRecordInDatabase
        key: string
        indexes: {
            // Use `network` field as index
            network: string
        }
    }
    /** Use inline keys */
    myself: {
        value: PersonRecordInDatabase
        key: string
    }
    /** Use `network` as out-of-line keys */
    localKeys: {
        value: LocalKeys
        key: string
    }
}
const db = openDB<PeopleDB>('maskbook-people-v2', 1, {
    upgrade(db, oldVersion, newVersion, transaction) {
        function v0_v1() {
            // inline keys
            db.createObjectStore('people', { keyPath: 'identifier' })
            // inline keys
            db.createObjectStore('myself', { keyPath: 'identifier' })
            db.createObjectStore('localKeys')

            transaction.objectStore('people').createIndex('network', 'network', { unique: false })
        }
        if (oldVersion < 1) v0_v1()
    },
})
//#endregion
//#region Other people
/**
 * Store a new person
 * @param record - PersonRecord
 */
export async function storeNewPersonDB(record: PersonRecord): Promise<void> {
    // ! Add await between a transaction and function end will cause the transaction closes !
    // ! Do ALL async works before opening an transaction
    const data = await toDb(record)
    const t = (await db).transaction('people', 'readwrite')
    await t.objectStore('people').put(data)
    sendNewPersonMessageDB(record)
    return
}
/**
 * Query person with a identifier
 */
export async function queryPeopleDB(
    query: ((key: PersonIdentifier, record: PersonRecordInDatabase) => boolean) | { network: string } = () => true,
): Promise<PersonRecord[]> {
    const t = (await db).transaction('people')
    const result: PersonRecordInDatabase[] = []
    if (typeof query === 'function') {
        // eslint-disable-next-line @typescript-eslint/await-thenable
        for await (const { value, key } of t.store) {
            if (query(Identifier.fromString(key) as PersonIdentifier, value)) result.push(value)
        }
    } else {
        result.push(
            ...(await t
                .objectStore('people')
                .index('network')
                .getAll(IDBKeyRange.only(query.network))),
        )
    }
    return Promise.all(result.map(outDb))
}
/**
 * Query people within a network
 * @param id - Identifier
 */
export async function queryPersonDB(id: PersonIdentifier): Promise<null | PersonRecord> {
    const t = (await db).transaction('people', 'readonly')
    const result = await t.objectStore('people').get(id.toText())

    const t2 = (await db).transaction('myself', 'readonly')
    const result2 = await t2.objectStore('myself').get(id.toText())
    if (!result && !result2) return null
    return outDb(Object.assign({}, result, result2))
}
/**
 * Update Person info with a identifier
 * @param person - Partial of person record
 */
export async function updatePersonDB(person: Partial<PersonRecord> & Pick<PersonRecord, 'identifier'>): Promise<void> {
    const full = (await queryPersonDB(person.identifier)) || { groups: [], identifier: person.identifier }
    if (!hasDifferent()) return

    const o: PersonRecordInDatabase = { ...(await toDb(full)), ...(await toDb(person as PersonRecord)) }

    const t = (await db).transaction('people', 'readwrite')
    await t.objectStore('people').put(o)
    sendNewPersonMessageDB(await outDb(o))

    function hasDifferent() {
        if (!isIdentifierArrayEquals(full.groups, person.groups || full.groups)) return true
        if (full.nickname !== (person.nickname || full.nickname)) return true
        if (!isIdentifierArrayEquals(full.previousIdentifiers, person.previousIdentifiers || full.previousIdentifiers))
            return true
        if (full.privateKey !== (person.privateKey || full.privateKey)) return true
        if (full.publicKey !== (person.publicKey || full.publicKey)) return true
        return false
    }
}
/**
 * Remove people from database
 * @param people - People to remove
 */
export async function removePeopleDB(people: PersonIdentifier[]): Promise<void> {
    const t = (await db).transaction('people', 'readwrite')
    for (const person of people) await t.objectStore('people').delete(person.toText())
    MessageCenter.emit('peopleChanged', undefined)
    return
}
//#endregion
//#region Myself
/**
 * Get my record
 * @param id - Identifier
 */
export async function queryMyIdentityAtDB(id: PersonIdentifier): Promise<null | PersonRecordPublicPrivate> {
    const t = (await db).transaction('myself')
    const result = await t.objectStore('myself').get(id.toText())
    if (!result) return null
    return outDb(result) as Promise<PersonRecordPublicPrivate>
}
/**
 * Remove my record
 * @param id - Identifier
 */
export async function removeMyIdentityAtDB(id: PersonIdentifier): Promise<void> {
    const t = (await db).transaction('myself', 'readwrite')
    await t.objectStore('myself').delete(id.toText())
    MessageCenter.emit('identityUpdated', undefined)
}
/**
 * Store my record
 * @param record - Record
 */
export async function storeMyIdentityDB(record: PersonRecordPublicPrivate): Promise<void> {
    if (!record.publicKey || !record.privateKey)
        throw new TypeError('No public/private key pair found when store self identity')
    const data = await toDb(record)

    const t = (await db).transaction('myself', 'readwrite')
    await t.objectStore('myself').put(data)
    MessageCenter.emit('identityUpdated', undefined)
}
/**
 * Get all my identities.
 */
export async function getMyIdentitiesDB(): Promise<PersonRecordPublicPrivate[]> {
    const t = (await db).transaction('myself')
    const result = await t.objectStore('myself').getAll()
    return Promise.all(result.map(outDb)) as Promise<PersonRecordPublicPrivate[]>
}
/**
 * Generate a new identity
 */
export async function generateMyIdentityDB(identifier: PersonIdentifier): Promise<void> {
    const now = await getMyIdentitiesDB()
    if (now.some(id => id.identifier.equals(identifier))) return
    const key = await generate_ECDH_256k1_KeyPair()
    await storeMyIdentityDB({
        groups: [],
        identifier,
        publicKey: key.publicKey,
        privateKey: key.privateKey,
    })
    await createDefaultFriendsGroup(identifier).catch(console.error)
    MessageCenter.emit('identityUpdated', undefined)
}
//#endregion
//#region LocalKeys

/**
 * Generate a new local key and store it
 * @param id - Identifier or 'default'
 */
export async function generateLocalKeyDB(id: PersonIdentifier) {
    const key = await generate_AES_GCM_256_Key()
    await storeLocalKeyDB(id, key)
    MessageCenter.emit('identityUpdated', undefined)
    return key
}
/**
 *
 * @param network
 */
export async function queryLocalKeyDB(network: string): Promise<LocalKeys>
export async function queryLocalKeyDB(identifier: PersonIdentifier): Promise<CryptoKey | null>
export async function queryLocalKeyDB(identifier: string | PersonIdentifier): Promise<LocalKeys | CryptoKey | null> {
    const t = (await db).transaction('localKeys')
    if (typeof identifier === 'string') {
        const result = await t.objectStore('localKeys').get(identifier)
        return result || {}
    } else {
        const store = await queryLocalKeyDB(identifier.network)
        return store[identifier.userId] || null
    }
}
/**
 * Store my local key for a network
 * @param arg0 - PersonIdentifier
 * @param key  - ! Keys MUST BE a native CryptoKey object !
 */
export async function storeLocalKeyDB({ network, userId }: PersonIdentifier, key: CryptoKey): Promise<void> {
    if (!(key instanceof CryptoKey)) {
        throw new TypeError('It is not a real CryptoKey!')
    }
    const t = (await db).transaction('localKeys', 'readwrite')
    const previous = (await t.objectStore('localKeys').get(network)) || {}
    const next = { ...previous, [userId]: key }
    await t.objectStore('localKeys').put(next, network)
    MessageCenter.emit('identityUpdated', undefined)
}
/**
 * Remove local key
 */
export async function deleteLocalKeyDB({ network, userId }: PersonIdentifier): Promise<void> {
    const t = (await db).transaction('localKeys', 'readwrite')
    const result = await t.objectStore('localKeys').get(network)
    if (!result) return
    delete result[userId]
    await t.objectStore('localKeys').put(result, network)
    MessageCenter.emit('identityUpdated', undefined)
}
/**
 * Get all my local keys.
 */
export async function getLocalKeysDB() {
    const t = (await db).transaction('localKeys')
    const result: Map<string, LocalKeys> = new Map()
    // eslint-disable-next-line @typescript-eslint/await-thenable
    for await (const { key, value } of t.objectStore('localKeys')) {
        result.set(key, value)
    }
    return result
}
//#endregion

async function sendNewPersonMessageDB(personRecord: PersonRecord) {
    MessageCenter.send('newPerson', await personRecordToPerson(personRecord))
}
