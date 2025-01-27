import { OnlyRunInContext } from '@holoflows/kit'
import { encodeText } from '../../utils/type-transform/String-ArrayBuffer'
import { sleep } from '../../utils/utils'
import { geti18nString } from '../../utils/i18n'
import {
    generateLocalKeyDB,
    generateMyIdentityDB,
    getLocalKeysDB,
    getMyIdentitiesDB,
    PersonRecordPublic,
    PersonRecordPublicPrivate,
    queryLocalKeyDB,
    queryMyIdentityAtDB,
    queryPeopleDB,
} from '../../database/people'
import { BackupJSONFileLatest, JSON_HINT_FOR_POWER_USER } from '../../utils/type-transform/BackupFile'
import { PersonIdentifier } from '../../database/type'
import { MessageCenter } from '../../utils/messages'
import getCurrentNetworkWorker from '../../social-network/utils/getCurrentNetworkWorker'
import { SocialNetworkUI } from '../../social-network/ui'
import { getWelcomePageURL } from '../options-page/Welcome/getWelcomePageURL'
import { getMyProveBio } from './CryptoServices/getMyProveBio'

OnlyRunInContext('background', 'WelcomeService')
async function generateBackupJSON(whoAmI: PersonIdentifier, full = false): Promise<BackupJSONFileLatest> {
    const manifest = browser.runtime.getManifest()
    const myIdentitiesInDB: BackupJSONFileLatest['whoami'] = []
    const peopleInDB: NonNullable<BackupJSONFileLatest['people']> = []

    const promises: Promise<void>[] = []
    //#region data.whoami
    const localKeys = await getLocalKeysDB()
    const myIdentity = await getMyIdentitiesDB()
    if (!whoAmI.isUnknown) {
        if ((await hasValidIdentity(whoAmI)) === false) {
            await createNewIdentity(whoAmI)
            return generateBackupJSON(whoAmI, full)
        }
    }
    async function addMyIdentitiesInDB(data: PersonRecordPublicPrivate) {
        myIdentitiesInDB.push({
            network: data.identifier.network,
            userId: data.identifier.userId,
            nickname: data.nickname,
            previousIdentifiers: data.previousIdentifiers,
            localKey: await exportKey(localKeys.get(data.identifier.network)![data.identifier.userId]!),
            publicKey: await exportKey(data.publicKey),
            privateKey: await exportKey(data.privateKey),
            [JSON_HINT_FOR_POWER_USER]:
                (await getMyProveBio(data.identifier)) ||
                'We are sorry, but this field is not available. It may help to set up Maskbook again.',
        })
    }
    for (const id of myIdentity) {
        promises.push(addMyIdentitiesInDB(id))
    }
    //#endregion

    //#region data.people
    async function addPeople(data: PersonRecordPublic) {
        peopleInDB.push({
            network: data.identifier.network,
            userId: data.identifier.userId,
            groups: data.groups.map(g => ({
                network: g.network,
                groupID: g.groupID,
                virtualGroupOwner: g.virtualGroupOwner,
            })),
            nickname: data.nickname,
            previousIdentifiers: (data.previousIdentifiers || []).map(p => ({ network: p.network, userId: p.userId })),
            publicKey: await exportKey(data.publicKey),
        })
    }
    if (full) {
        for (const p of await queryPeopleDB(() => true)) {
            if (p.publicKey) promises.push(addPeople(p as PersonRecordPublic))
        }
    }
    //#endregion

    await Promise.all(promises)
    const grantedHostPermissions = (await browser.permissions.getAll()).origins || []
    if (full)
        return {
            version: 1,
            whoami: myIdentitiesInDB,
            people: peopleInDB,
            grantedHostPermissions,
            maskbookVersion: manifest.version,
        }
    else
        return {
            version: 1,
            whoami: myIdentitiesInDB,
            grantedHostPermissions,
            maskbookVersion: manifest.version,
        }
    function exportKey(k: CryptoKey) {
        return crypto.subtle.exportKey('jwk', k)
    }
}
async function hasValidIdentity(whoAmI: PersonIdentifier) {
    const local = await queryLocalKeyDB(whoAmI)
    const ecdh = await queryMyIdentityAtDB(whoAmI)
    return !!local && !!ecdh && !!ecdh.privateKey && !!ecdh.publicKey
}

async function createNewIdentity(whoAmI: PersonIdentifier) {
    await generateLocalKeyDB(whoAmI)
    await generateMyIdentityDB(whoAmI)
    // ? New user !
    MessageCenter.emit('generateKeyPair', undefined)
    console.log('New user! Generating key pairs')
}

export async function backupMyKeyPair(whoAmI: PersonIdentifier, download = true) {
    // Don't make the download pop so fast
    await sleep(1000)
    const obj = await generateBackupJSON(whoAmI)
    if (!download) return obj
    const string = JSON.stringify(obj)
    const buffer = encodeText(string)
    const blob = new Blob([buffer], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const date = new Date()
    const today = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date
        .getDate()
        .toString()
        .padStart(2, '0')}`
    browser.downloads.download({
        url,
        filename: `maskbook-keystore-backup-${today}.json`,
        saveAs: true,
    })
    return obj
}

export async function openWelcomePage(id?: SocialNetworkUI['lastRecognizedIdentity']['value']) {
    if (id) {
        if (!getCurrentNetworkWorker(id.identifier).isValidUsername(id.identifier.userId))
            throw new TypeError(geti18nString('service_username_invalid'))
    }
    return browser.tabs.create({ url: getWelcomePageURL(id) })
}
