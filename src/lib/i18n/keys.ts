import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { keyOf } from "./index";

// Finds every text the app can show, by reading the source. Used by the test that checks
// the Norwegian table has all of them, and by the script that lists what is missing.
// Not part of the app itself: nothing a screen imports may import this.

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

/** Files where a finished sentence is an error message shown by a form, said in the reader's language there. */
const MESSAGE_FILES = /actions\.ts$|lib[\\/](money|rate-limit)\.ts$/;
const sentence = (text: string) => /^[A-Z"“][\s\S]*[.?!…]$/.test(text.trim()) && /\s/.test(text.trim());

/** Every key the source asks for, with one place it is asked from. */
export function collectKeys(root: string): Map<string, string> {
  const keys = new Map<string, string>();
  const files = walk(join(root, "src")).filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$|logo-data|i18n[\\/]/.test(file));
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const where = relative(root, file).replaceAll("\\", "/");
    const add = (key: string, node: ts.Node) => {
      if (key.trim() !== "" && !keys.has(key)) keys.set(key, `${where}:${tree.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
    };
    const templateKey = (template: ts.TemplateLiteral) =>
      ts.isNoSubstitutionTemplateLiteral(template) ? template.text : keyOf([template.head.text, ...template.templateSpans.map((span) => span.literal.text)]);
    const messages = MESSAGE_FILES.test(file);

    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && (node.expression.text === "t" || node.expression.text === "m")) {
        const [first] = node.arguments;
        if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) add(first.text, node);
      } else if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && node.tag.text === "t") {
        add(templateKey(node.template), node);
      } else if (messages && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !ts.isImportDeclaration(node.parent)) {
        if (sentence(node.text)) add(node.text, node);
      } else if (messages && ts.isTemplateExpression(node) && !ts.isTaggedTemplateExpression(node.parent)) {
        const key = templateKey(node);
        if (sentence(key.replace(/\{\d+\}/g, "X"))) add(key, node);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  return keys;
}
