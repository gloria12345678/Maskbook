import { env, Profile, SocialNetworkWorkerAndUI } from './shared'
import { GetContext } from '@holoflows/kit/es'
import { PersonIdentifier, PostIdentifier } from '../database/type'
import { startWorkerService } from '../extension/background-script/WorkerService'
import { defaultSocialNetworkWorker } from './defaults/worker'
import { defaultSharedSettings } from './defaults/shared'
import getCurrentNetworkWorker from './utils/getCurrentNetworkWorker'

/**
 * A SocialNetworkWorker is running in the background page
 */
export interface SocialNetworkWorkerDefinition extends SocialNetworkWorkerAndUI {
    /**
     * This function should fetch the given post by `fetch`, `AutomatedTabTask` or anything
     * @param postIdentifier The post id
     */
    fetchPostContent(postIdentifier: PostIdentifier<PersonIdentifier>): Promise<string>
    /**
     * This function should fetch the given post by `fetch`, `AutomatedTabTask` or anything
     * @param identifier The post id
     */
    fetchProfile(identifier: PersonIdentifier): Promise<Profile>
    /**
     * This function should open a new page, then automatically input provePost to bio
     *
     * If this function is not provided, autoVerifyBio in Welcome will be unavailable
     */
    autoVerifyBio?: ((user: PersonIdentifier, provePost: string) => void) | null
    /**
     * This function should open a new page, then automatically input provePost to the post box
     *
     * If this function is not provided, autoVerifyPost in Welcome will be unavailable
     */
    autoVerifyPost?: ((user: PersonIdentifier, provePost: string) => void) | null
    /**
     * This function should open a new page, then let user add it by themself
     *
     * If this function is not provided, manualVerifyPost in Welcome will be unavailable
     */
    manualVerifyPost?: ((user: PersonIdentifier, provePost: string) => void) | null
}

export type SocialNetworkWorker = Required<SocialNetworkWorkerDefinition>
export const getWorker = getCurrentNetworkWorker

export const definedSocialNetworkWorkers = new Set<SocialNetworkWorker>()
export function defineSocialNetworkWorker(worker: SocialNetworkWorkerDefinition) {
    if (worker.acceptablePayload.includes('v40') && worker.internalName !== 'facebook') {
        throw new TypeError('Payload version v40 is not supported in this network. Please use v39 or newer.')
    }

    const res: SocialNetworkWorker = {
        ...defaultSharedSettings,
        ...defaultSocialNetworkWorker,
        ...worker,
    }

    if (worker.notReadyForProduction) {
        if (process.env.NODE_ENV === 'production') return res
    }

    definedSocialNetworkWorkers.add(res)
    if (GetContext() === 'background') {
        console.log('Activating social network provider', res.networkIdentifier, worker)
        res.init(env, {})
        startWorkerService(res)
    }
    return res
}
