import * as ts from 'typescript'
import * as fs from 'fs'

const preTransformTable = new Map<string, string>()
preTransformTable.set('@holoflows/kit/es', '@holoflows/kit')
preTransformTable.set('webcrypto-liner/dist/webcrypto-liner.shim.js', '/polyfills/webcrypto-liner.shim.js')
export default function(program: ts.Program, pluginOptions: {}) {
    return (ctx: ts.TransformationContext) => {
        return (sourceFile: ts.SourceFile) => {
            function visitor(node: ts.Node): ts.Node {
                if (ts.isImportDeclaration(node)) {
                    // transform `import ... from '...'
                    const newPath = rewriteImport((node.moduleSpecifier as ts.StringLiteral).text, sourceFile.fileName)
                    return ts.createImportDeclaration(
                        node.decorators,
                        node.modifiers,
                        node.importClause,
                        ts.createStringLiteral(newPath),
                    )
                } else if (ts.isExportDeclaration(node)) {
                    // transform `export ... from '...'`
                    if (!node.moduleSpecifier) return node
                    const newPath = rewriteImport((node.moduleSpecifier as ts.StringLiteral).text, sourceFile.fileName)
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

function rewriteImport(imp: string, currentFilePath: string, dir = 'web_modules'): string {
    if (preTransformTable.has(imp)) imp = preTransformTable.get(imp)!
    const isSourceImport = imp.startsWith('.') || imp.startsWith('\\')
    const isRemoteImport = imp.startsWith('http://') || imp.startsWith('https://') || imp.startsWith('/')
    if (!isSourceImport && !isRemoteImport) {
        return path.posix.join('/', dir, `${getWebDependencyName(imp)}.js`)
    }
    const fullPath = path.join(path.dirname(currentFilePath), imp)
    try {
        if (fs.existsSync(fullPath + '.js') || fs.existsSync(fullPath + '.ts') || fs.existsSync(fullPath + '.tsx'))
            return imp + '.js'
    } catch {}
    try {
        if (
            fs.existsSync(fullPath + '/index.js') ||
            fs.existsSync(fullPath + '/index.ts') ||
            fs.existsSync(fullPath + '/index.tsx')
        )
            return imp + '/index.js'
    } catch {}
    return imp
}
