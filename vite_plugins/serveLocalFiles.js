import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';

// Streams a local folder (with Range support) during `vite dev` and `vite preview` only, for
// assets too large to ship in dist/ (the ~600MB of rendered flipbook pages). Nothing is copied.
export function serveLocalFiles({ directory, routePrefix, contentTypes }) {
  const rootDirectory = path.resolve(directory);

  function handleRequest(request, response, next) {
    if (!request.url?.startsWith(routePrefix)) {
      next();
      return;
    }

    const fileName = decodeURIComponent(request.url.slice(routePrefix.length).split('?')[0]);
    const filePath = path.resolve(rootDirectory, fileName);
    const isInsideRoot = filePath.startsWith(rootDirectory + path.sep);
    const contentType = contentTypes[path.extname(filePath).toLowerCase()];

    let fileSize;
    try {
      fileSize = isInsideRoot && contentType ? statSync(filePath).size : null;
    } catch {
      fileSize = null;
    }
    if (fileSize === null) {
      response.statusCode = 404;
      response.end();
      return;
    }

    response.setHeader('Content-Type', contentType);
    response.setHeader('Accept-Ranges', 'bytes');

    const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '');
    if (rangeMatch) {
      const start = rangeMatch[1] ? Number(rangeMatch[1]) : Math.max(0, fileSize - Number(rangeMatch[2]));
      const end = rangeMatch[1] && rangeMatch[2] ? Math.min(Number(rangeMatch[2]), fileSize - 1) : fileSize - 1;
      if (start > end || start >= fileSize) {
        response.statusCode = 416;
        response.setHeader('Content-Range', `bytes */${fileSize}`);
        response.end();
        return;
      }
      response.statusCode = 206;
      response.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      response.setHeader('Content-Length', end - start + 1);
      createReadStream(filePath, { start, end }).pipe(response);
      return;
    }

    response.setHeader('Content-Length', fileSize);
    createReadStream(filePath).pipe(response);
  }

  return {
    name: 'serve-local-files',
    configureServer(server) {
      server.middlewares.use(handleRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleRequest);
    },
  };
}
