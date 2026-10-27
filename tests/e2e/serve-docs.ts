import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docsOutput = path.resolve(
  fileURLToPath(new URL("../../apps/docs/.blume-verify/dist", import.meta.url))
);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

if (!existsSync(path.join(docsOutput, "api/v1/index.html"))) {
  throw new Error("Build the docs app before starting its static test server.");
}

createServer((request, response) => {
  const { url = "/" } = request;
  const { pathname } = new URL(url, "http://localhost");

  const relativePath = decodeURIComponent(pathname.slice(1)).replace(
    /\/$/u,
    ""
  );

  const requestedPath = path.join(docsOutput, relativePath);
  const resolvedPath = path.resolve(requestedPath);

  if (
    resolvedPath !== docsOutput &&
    !resolvedPath.startsWith(`${docsOutput}${path.sep}`)
  ) {
    response.writeHead(400).end("Invalid path");

    return;
  }

  const filePath = path.extname(resolvedPath)
    ? resolvedPath
    : path.join(resolvedPath, "index.html");

  if (!existsSync(filePath)) {
    response.writeHead(404).end("Not found");

    return;
  }

  response.writeHead(200, {
    "Content-Type":
      contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
  });

  createReadStream(filePath).pipe(response);
}).listen(4321, "127.0.0.1");
