import { defineSocialNetworkUI } from "../../../social-network/ui"
import { initialState } from "../utils/selector"
import { shouldDisplayWelcomeDefault } from '../../../social-network/defaults/shouldDisplayWelcome'
import { InitFriendsValueRef } from '../../../social-network/defaults/FriendsValueRef'
import { InitMyIdentitiesValueRef } from '../../../social-network/defaults/MyIdentitiesRef'
import { setStorage } from "../../../utils/browser.storage"
import { sharedSettings } from "../index";

export const instanceOfMastodonUI = defineSocialNetworkUI({
    ...sharedSettings,
    ...mastodonUIDataSources,
    ...mastodonUITasks,
    ...mastodonUIInjections,
    ...mastodonUIFetch,
    init: (env, pref) => {
        sharedSettings.init(env, pref)
        InitFriendsValueRef(instanceOfMastodonUI, host)
        InitMyIdentitiesValueRef(instanceOfMastodonUI, host)
    },
    shouldActivate() {
        const state = initialState()
        // TODO handle some fork names
        return state && state.meta.repository.endsWith('mastodon')
    },
    friendlyName: 'Mastodon (Developing...)',
    // ? We need the interface to give us a current URL or the identifier...
    // ? In fact we need the typical fediv cross-site follow/login: enter your
    // ? name@site.moe account.
    setupAccount: async () => {
        await browser.permissions.request({
            origins: [`${hostURL}/*`],
        })
        setStorage(host, { forceDisplayWelcome: true }).then()
        window.open(hostURL as string)
    },
    ignoreSetupAccount() {
        setStorage(host, { userIgnoredWelcome: true }).then()
    },
    shouldDisplayWelcome: shouldDisplayWelcomeDefault,
})
