import * as ts from 'typescript'

const printer = ts.createPrinter({})
export default function(program: ts.Program, pluginOptions: {}) {
    return (ctx: ts.TransformationContext) => {
        return (sourceFile: ts.SourceFile) => {
            function visitor(node: ts.Node): ts.Node {
                if (ts.isImportDeclaration(node)) {
                    // transform `import ... from '...'
                    const newPath = rewriteImport((node.moduleSpecifier as ts.StringLiteral).text)
                    return ts.createImportDeclaration(
                        node.decorators,
                        node.modifiers,
                        node.importClause,
                        ts.createStringLiteral(newPath),
                    )
                } else if (ts.isExportDeclaration(node)) {
                    // transform `export ... from '...'`
                    if (!node.moduleSpecifier) return node
                    const newPath = rewriteImport((node.moduleSpecifier as ts.StringLiteral).text)
                    return ts.createExportDeclaration(
                        node.decorators,
                        node.modifiers,
                        node.exportClause,
                        ts.createStringLiteral(newPath),
                    )
                }
                // TODO: transform import(...)
                return ts.visitEachChild(node, visitor, ctx)
            }
            return ts.visitEachChild(sourceFile, visitor, ctx)
        }
    }
}

// Code below is derived from https://github.com/pikapkg/web/blob/master/assets/babel-plugin.js
import * as path from 'path'
// A lame copy-paste from src/index.ts
function getWebDependencyName(dep: string) {
    return dep.replace(/\.js$/, '')
}

function rewriteImport(imp: string, dir = 'web_modules', shouldAddMissingExtension = true): string {
    const isSourceImport = imp.startsWith('/') || imp.startsWith('.') || imp.startsWith('\\')
    const isRemoteImport = imp.startsWith('http://') || imp.startsWith('https://')
    if (!isSourceImport && !isRemoteImport) {
        console.log('Rewriting', imp, 'to', path.posix.join('/', dir, `${getWebDependencyName(imp)}.js`))
        return path.posix.join('/', dir, `${getWebDependencyName(imp)}.js`)
    }
    if (!isRemoteImport && shouldAddMissingExtension && !path.extname(imp)) {
        return imp + '.js'
    }
    return imp
}
