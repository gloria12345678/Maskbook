import { AsyncCall, AsyncGeneratorCall, AsyncCallOptions } from 'async-call-rpc'
import { GetContext, OnlyRunInContext } from '@holoflows/kit/es/Extension/Context'
import * as MockService from './mock-service'
import Serialization from '../utils/type-transform/Serialization'
import { PersonIdentifier, GroupIdentifier, PostIdentifier, PostIVIdentifier } from '../database/type'
import { getCurrentNetworkWorkerService } from './background-script/WorkerService'

import tasks from './content-script/tasks'
import { MessageCenter } from '@holoflows/kit/es'
Object.assign(globalThis, { tasks })

interface Services {
    Crypto: typeof import('./background-script/CryptoService')
    People: typeof import('./background-script/PeopleService')
    Welcome: typeof import('./background-script/WelcomeService')
}
const Services = {} as Services
export default Services

const logOptions: AsyncCallOptions['log'] = {
    beCalled: false,
    localError: true,
    remoteError: true,
    sendLocalStack: true,
    type: 'pretty',
}
if (!('Services' in globalThis)) {
    Object.assign(globalThis, { Services })
    // Sorry you should add import at '../background-service.ts'
    register(Reflect.get(globalThis, 'CryptoService'), 'Crypto', MockService.CryptoService)
    register(Reflect.get(globalThis, 'WelcomeService'), 'Welcome', MockService.WelcomeService)
    register(Reflect.get(globalThis, 'PeopleService'), 'People', MockService.PeopleService)
}
interface ServicesWithProgress {
    // Sorry you should add import at '../background-service.ts'
    decryptFrom: typeof import('./background-script/CryptoServices/decryptFrom').decryptFromMessageWithProgress
}
export const ServicesWithProgress = AsyncGeneratorCall<ServicesWithProgress>(
    Reflect.get(globalThis, 'ServicesWithProgress'),
    {
        key: 'Service+',
        log: logOptions,
        serializer: Serialization,
        messageChannel: new MessageCenter(),
    },
)

Object.assign(globalThis, {
    PersonIdentifier,
    GroupIdentifier,
    PostIdentifier,
    PostIVIdentifier,
    getCurrentNetworkWorkerService,
})
//#region
type Service = Record<string, (...args: any[]) => Promise<any>>
function register<T extends Service>(service: T, name: keyof Services, mock?: Partial<T>) {
    if (OnlyRunInContext(['content', 'options', 'debugging', 'background'], false)) {
        GetContext() !== 'debugging' && console.log(`Service ${name} registered in ${GetContext()}`)
        const base = service
            ? {
                  methods() {
                      return Object.keys(service)
                          .map(f => service[f].toString().split('\n')[0])
                          .join('\n')
                  },
              }
            : {}
        Object.assign(Services, {
            [name]: AsyncCall(Object.assign(base, service), {
                key: name,
                serializer: Serialization,
                log: logOptions,
                preferLocalImplementation: true,
                messageChannel: new MessageCenter(),
            }),
        })
        Object.assign(globalThis, { [name]: Object.assign({}, service) })
        if (GetContext() === 'debugging') {
            // ? -> UI developing
            const mockService = new Proxy(mock || {}, {
                get(target: any, key: string) {
                    return async function(...args: any[]) {
                        if (target[key]) return target[key](...args)
                        return void 0
                    }
                },
            })
            AsyncCall(mockService, {
                key: name,
                serializer: Serialization,
                log: logOptions,
                messageChannel: new MessageCenter(),
            })
        }
    } else {
        console.warn('Unknown environment, service not registered')
    }
}
//#endregion
