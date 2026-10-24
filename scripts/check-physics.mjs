import ts from "typescript";
import { readFileSync } from "node:fs";
const file = "shared/games/red-thread/sim.ts",
  source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.ES2022,
    true,
  ),
  problems = [];
function visit(node) {
  if (ts.isNumericLiteral(node) && !Number.isInteger(Number(node.text)))
    problems.push("Noninteger literal " + node.text);
  if (
    ts.isPropertyAccessExpression(node) &&
    node.expression.getText(source) === "Math" &&
    [
      "random",
      "sin",
      "cos",
      "tan",
      "atan2",
      "pow",
      "exp",
      "log",
      "sqrt",
    ].includes(node.name.text)
  )
    problems.push("Forbidden " + node.getText(source));
  ts.forEachChild(node, visit);
}
visit(source);
if (problems.length) throw new Error(problems.join("\n"));
console.log(
  "PASS integer simulation lint: no floating literals or forbidden Math calls",
);
