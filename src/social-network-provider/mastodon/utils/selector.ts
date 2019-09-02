import { LiveSelector } from '@holoflows/kit'
import * as mastotype from '../types';

const querySelector = <T extends HTMLElement>(selector: string) => {
    return new LiveSelector().querySelector<T>(selector).enableSingleMode()
}

const querySelectorAll = <T extends HTMLElement>(selector: string) => {
    return new LiveSelector().querySelectorAll<T>(selector)
}

export const initialStateElem = querySelector<HTMLScriptElement>('script[type="application/json"]#initial-state')

export function initialState(): mastotype.initialState | null {
    const initialStateElement = initialStateElem()
    return initialStateElement ? JSON.parse(initialStateElement.innerHTML) : null
}

export function myInfo(): mastotype.Account | null {
    const initialStateValue = initialState()
    return initialStateValue ? initialStateValue.accounts[initialStateValue.meta.me] : null
}
