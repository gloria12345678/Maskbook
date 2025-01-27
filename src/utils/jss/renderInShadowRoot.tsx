import { create } from 'jss'
import { jssPreset, createGenerateClassName, StylesProvider, ThemeProvider } from '@material-ui/styles'
import ReactDOM from 'react-dom'
import React from 'react'
import { MaskbookLightTheme, MaskbookDarkTheme } from '../theme'
import ConstructableStyleSheetsRenderer, {
    livingShadowRoots,
    applyAdoptedStyleSheets,
} from './ConstructableStyleSheetsRenderer'

const jss = create({ ...jssPreset(), Renderer: ConstructableStyleSheetsRenderer as any })
/**
 * Render the Node in the ShadowRoot
 * @param node React Node
 * @param shadow ShadowRoot that want to inject to
 */
export function renderInShadowRoot(node: React.ReactNode, shadow: ShadowRoot) {
    if (shadow.mode === 'open') console.warn('Do not render with open ShadowRoot!')
    ReactDOM.render(<RenderInShadowRootWrapper children={node} />, shadow as any)
    livingShadowRoots.add(shadow)
    applyAdoptedStyleSheets()
    return () => {
        ReactDOM.unmountComponentAtNode(shadow as any)
        livingShadowRoots.delete(shadow)
    }
}

const generateClassName = createGenerateClassName()
export class RenderInShadowRootWrapper extends React.PureComponent {
    state: { error?: Error } = { error: undefined }
    render() {
        if (this.state.error) return this.state.error.message
        return <Maskbook children={this.props.children} />
    }
    componentDidCatch(error: Error) {
        this.setState({ error })
    }
}
function Maskbook(props: any) {
    // const isDarkTheme = useMediaQuery('(prefers-color-scheme: dark)')
    const isDarkTheme = false
    return (
        <StylesProvider jss={jss} generateClassName={generateClassName}>
            <ThemeProvider theme={isDarkTheme ? MaskbookDarkTheme : MaskbookLightTheme}>
                <div {...props} />
            </ThemeProvider>
        </StylesProvider>
    )
}
