import path from "path";
import JSONStream from "JSONStream";
import byline from "byline";
import fs from "fs";
import sortBy from "lodash/sortBy";
import partition from "lodash/partition";
import groupBy from "lodash/groupBy";
import flatten from "lodash/flatten";
import isEmpty from "lodash/isEmpty";

const SUMMARY_FILE = "_todos.md";
const NOTES_DIR = "/Users/maxedmands/Projects/notes";
const CHECKBOX_REGEX = /\[(\s|x)\]\s*(.*)/;
const TITLE_REGEX = /^\s*#+\s*(\w.+)/;
const IGNORE_PATTERN = /(\.sw[a-p]|\.DS_Store|\.log|~|\.tmproj(ect)?|^\.git.*)$/;

const stream = JSONStream.parse([true]);
stream.on("data", handleFileUpdate);

process.stdin.pipe(stream);

function handleFileUpdate({ name: file, exists }) {
  if (!exists) return;
  if (IGNORE_PATTERN.test(file)) {
    process.stdout.write(`Ignoring ${file}.\n`);
    return;
  }
  if (file === SUMMARY_FILE) return;
  const filePath = path.join(NOTES_DIR, file);
  const stream = byline.createStream(fs.createReadStream(filePath), {
    keepEmptyLines: true
  });
  let title;
  let lineNumber = 0;
  const todos = [];
  stream.on("data", function(data) {
    lineNumber += 1;
    const line = data.toString();
    const titleMatch = line.match(TITLE_REGEX);
    const checkboxMatch = line.match(CHECKBOX_REGEX);

    if (titleMatch != null) {
      title = titleMatch[1];
    }

    if (checkboxMatch != null) {
      const todoText = checkboxMatch[2];
      todos.push({
        done: checkboxMatch[1] === "x",
        text: checkboxMatch[2],
        title,
        file,
        lineNumber
      });
    }
  });

  stream.on("end", function() {
    writeTodosFile(todos);
  });
}

function writeTodosFile(todos) {
  const [done, outstanding] = partition(todos, todo => todo.done);
  const outstandingByFile = groupBy(outstanding, todo => todo.file);
  const fileText = [
    "# TODO SUMMARY",
    "",
    ...flatten(
      Object.keys(outstandingByFile).map(fileName => {
        const fileTodos = outstandingByFile[fileName];
        const outstandingByTitle = groupBy(fileTodos, todo => todo.title);
        return [
          `## ${fileName}`,
          ...flatten(
            Object.keys(outstandingByTitle).sort().map(title => {
              const titleTodos = outstandingByTitle[title];
              const head = [""];
              // TODO this is gross.
              if (!isEmpty(title) && title !== "undefined") {
                head.push(`### ${title}`);
              }
              return [...head, ...titleTodos.map(todoText)];
            })
          )
        ];
      })
    ),
    "",
    "----------------",
    "",
    "# DONE",
    ...done.map(todoText)
  ].join("\n");

  fs.writeFileSync(SUMMARY_FILE, fileText, { encoding: "utf-8" });
}

function todoText(todo) {
  return [
    `[${todo.done ? "x" : " "}]`,
    todo.text,
    `[${todo.file}:${todo.lineNumber}]`
  ].join(" ");
}
