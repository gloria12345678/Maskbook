// Someone may have a better type definition than this... anyway
// gotta read the docs and put this on definitivelyTyped.
// This file, JUST this one, is not AGPLv3. Call it CC0-1.0 for now.
//
// Some are identical to https://docs.joinmastodon.org/api/. We just
// need this for the JSON state for now.
export interface initialState {
    meta: Meta
    compose: Compose
    accounts: Accounts
    media_attachments: MediaAttachments
    settings: Settings
    push_subscription?: null
}
export interface Meta {
    streaming_api_base_url: string
    access_token: string
    locale: string
    domain: string
    admin: string
    search_enabled: boolean
    repository: string
    source_url: string
    version: string
    invites_enabled: boolean
    mascot?: null
    profile_directory: boolean
    me: string
    unfollow_modal: boolean
    boost_modal: boolean
    delete_modal: boolean
    auto_play_gif: boolean
    display_media: string
    expand_spoilers: boolean
    reduce_motion: boolean
    advanced_layout: boolean
    is_staff: boolean
}
export interface Compose {
    me: string
    default_privacy: string
    default_sensitive: boolean
}
export interface Accounts {
    [accoundId: string]: Account
}
export interface Account {
    id: string
    username: string
    acct: string
    display_name: string
    locked: boolean
    bot: boolean
    created_at: string
    note: string
    url: string
    avatar: string
    avatar_static: string
    header: string
    header_static: string
    followers_count: number
    following_count: number
    statuses_count: number
    emojis?: (EmojiEntity)[] | null
    fields?: (HashEntity)[] | null
}
export interface EmojiEntity {
    shortcode: string
    static_url: string
    url: string
    visible_in_picker: boolean
}
export interface HashEntity {
    name: string
    value: string
    verified_at?: null
}
export interface MediaAttachments {
    accept_content_types?: (string)[] | null
}
export interface Settings {
    frequentlyUsedEmojis: FrequentlyUsedEmojis
    onboarded: boolean
    notifications: NotificationOptions
    public: NotificationFilter
    direct: NotificationFilter
    community: NotificationFilter
    skinTone: number
    trends: Trends
    columns?: (ColumnsEntity)[] | null
    introductionVersion: number
    home: Home
}
export interface FrequentlyUsedEmojis {
    [shortcode: string]: number
}
export interface NotificationOptions {
    alerts: NotificationSwitches
    quickFilter: QuickFilter
    shows: NotificationSwitches
    sounds: NotificationSwitches
}
export interface NotificationSwitches {
    follow: boolean
    favourite: boolean
    reblog: boolean
    mention: boolean
    poll: boolean
}
export interface QuickFilter {
    active: string
    show: boolean
    advanced: boolean
}
export interface NotificationFilter {
    regex: Regex
}
export interface Regex {
    body: string
}
export interface Trends {
    show: boolean
}
export interface ColumnsEntity {
    id: string
    uuid: string
    params?: any
}
export interface Home {
    shows: Shows
    regex: Regex
}
export interface Shows {
    reblog: boolean
    reply: boolean
}
