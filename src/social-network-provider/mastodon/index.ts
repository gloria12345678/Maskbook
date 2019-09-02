import { SocialNetworkWorkerAndUI } from '../../social-network/shared'

// ? we cannot export a host name

export const sharedSettings: SocialNetworkWorkerAndUI = {
    version: 1,
    internalName: 'mastodon',
    isDangerousNetwork: false,
    // ? we will need to accept 'other fediverse' networks like GNUsoc and... Gab (we have these users)
    // ? maybe fediverse-mastodon/site.social/foo
    networkIdentifier: 'fediverse-mastodon',
    // USERNAME_RE
    isValidUsername: /[a-z0-9_]+([a-z0-9_\.-]+[a-z0-9_]+)?/i.test,
    acceptablePayload: ['latest'],
    init() {},
    isTesting: true,
}
