import { createNewSettings } from './createSettings'
/**
 * Does the debug mode on
 */
export const debugModeSetting = createNewSettings<boolean>('debugMode', false, {
    primary: 'Enable debug mode',
    secondary: 'Enable this will display additional information on the Maskbook UI to help debugging',
})
/**
 * Never open a new tab in the background
 */
export const disableOpenNewTabInBackgroundSettings = createNewSettings<boolean>(
    'disable automated tab task open new tab',
    false,
    {
        primary: 'Disable open hidden tabs in the background',
        secondary:
            "Many of Maskbook features relies on this behavior. Disable this behavior will limit Maskbook's functionality",
    },
)
