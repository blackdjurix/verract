function findExactFolderUnder_(parentFolder, name) {
  var iterator = parentFolder.getFoldersByName(name);
  var matches = [];

  while (iterator.hasNext()) {
    matches.push(iterator.next());
    if (matches.length > 1) break;
  }

  if (matches.length > 1) {
    return { status: 'AMBIGUOUS', folder: null };
  }

  if (matches.length === 1) {
    return { status: 'FOUND', folder: matches[0] };
  }

  return { status: 'NOT_FOUND', folder: null };
}

function findExactFileInFolder_(folder, filename) {
  var iterator = folder.getFilesByName(filename);
  var matches = [];

  while (iterator.hasNext()) {
    matches.push(iterator.next());
    if (matches.length > 1) break;
  }

  if (matches.length > 1) {
    return { status: 'AMBIGUOUS', file: null, count: matches.length };
  }

  if (matches.length === 1) {
    return { status: 'FOUND', file: matches[0], count: 1 };
  }

  return { status: 'NOT_FOUND', file: null, count: 0 };
}

function findFolderByPath_(rootId, path) {
  var segments = splitPathSegments_(path);
  if (!rootId || !segments.length) {
    return {
      status: 'INVALID_INPUT',
      folder: null,
      pathId: '',
      matchedPath: '',
      note: 'RootID and path are required.'
    };
  }

  var current;
  try {
    current = DriveApp.getFolderById(rootId);
  } catch (err) {
    return {
      status: 'INVALID_INPUT',
      folder: null,
      pathId: '',
      matchedPath: '',
      note: 'Root folder cannot be opened: ' + err.message
    };
  }

  var matchedSegments = [];

  for (var i = 0; i < segments.length; i++) {
    var result = findExactFolderUnder_(current, segments[i]);

    if (result.status === 'AMBIGUOUS') {
      return {
        status: 'AMBIGUOUS',
        folder: null,
        pathId: current.getId(),
        matchedPath: matchedSegments.join('\\'),
        note: 'Ambiguous folder segment: ' + segments[i]
      };
    }

    if (result.status === 'NOT_FOUND') {
      return {
        status: 'PATH_NOT_FOUND',
        folder: null,
        pathId: matchedSegments.length ? current.getId() : '',
        matchedPath: matchedSegments.join('\\'),
        note: 'Path segment not found: ' + segments[i]
      };
    }

    current = result.folder;
    matchedSegments.push(segments[i]);
  }

  return {
    status: 'FOUND',
    folder: current,
    pathId: current.getId(),
    matchedPath: matchedSegments.join('\\'),
    note: ''
  };
}

function verifyExactPair_(input) {
  if (!input.rootId || !input.filename || !input.candidates.length) {
    return {
      exists: false,
      status: 'INVALID_INPUT',
      checkedPathCount: 0,
      matchedPathColumn: '',
      candidateCount: 0,
      pathId: '',
      fileId: '',
      path: '',
      filename: input.filename || '',
      note: 'RootID, candidate path, and filename are required.'
    };
  }

  var checked = 0;
  var firstPathEvidence = null;
  var firstPathMissing = null;

  for (var i = 0; i < input.candidates.length; i++) {
    var candidate = input.candidates[i];
    checked++;

    var folderResult = findFolderByPath_(input.rootId, candidate.path);

    if (folderResult.status === 'AMBIGUOUS') {
      return {
        exists: false,
        status: 'AMBIGUOUS',
        checkedPathCount: checked,
        matchedPathColumn: candidate.columnLetter,
        candidateCount: 0,
        pathId: folderResult.pathId || '',
        fileId: '',
        path: folderResult.matchedPath || candidate.path,
        filename: input.filename,
        note: folderResult.note
      };
    }

    if (folderResult.status !== 'FOUND') {
      if (!firstPathMissing) {
        firstPathMissing = {
          columnLetter: candidate.columnLetter,
          path: candidate.path,
          note: folderResult.note || ''
        };
      }
      continue;
    }

    if (!firstPathEvidence) {
      firstPathEvidence = {
        columnLetter: candidate.columnLetter,
        folder: folderResult.folder,
        pathId: folderResult.pathId,
        path: folderResult.matchedPath || candidate.path
      };
    }

    var fileResult = findExactFileInFolder_(folderResult.folder, input.filename);

    if (fileResult.status === 'AMBIGUOUS') {
      return {
        exists: false,
        status: 'AMBIGUOUS',
        checkedPathCount: checked,
        matchedPathColumn: candidate.columnLetter,
        candidateCount: fileResult.count,
        pathId: folderResult.pathId,
        fileId: '',
        path: folderResult.matchedPath || candidate.path,
        filename: input.filename,
        note: 'Ambiguous file exact match in path.'
      };
    }

    if (fileResult.status === 'FOUND') {
      return {
        exists: true,
        status: 'RESOLVED',
        checkedPathCount: checked,
        matchedPathColumn: candidate.columnLetter,
        candidateCount: 1,
        pathId: folderResult.pathId,
        fileId: fileResult.file.getId(),
        path: folderResult.matchedPath || candidate.path,
        filename: input.filename,
        note: ''
      };
    }
  }

  if (firstPathEvidence) {
    return {
      exists: false,
      status: 'PATH_FOUND_FILE_MISSING',
      checkedPathCount: checked,
      matchedPathColumn: firstPathEvidence.columnLetter,
      candidateCount: 0,
      pathId: firstPathEvidence.pathId,
      fileId: '',
      path: firstPathEvidence.path,
      filename: input.filename,
      note: 'Exact file not found in matched path.'
    };
  }

  return {
    exists: false,
    status: 'PATH_NOT_FOUND',
    checkedPathCount: checked,
    matchedPathColumn: '',
    candidateCount: 0,
    pathId: '',
    fileId: '',
    path: firstPathMissing ? firstPathMissing.path : '',
    filename: input.filename,
    note: firstPathMissing && firstPathMissing.note
      ? firstPathMissing.note
      : 'Exact path not found.'
  };
}

function resolveExactPair_(input) {
  if (!input.rootId || !input.filename || !input.candidates.length) {
    return {
      exists: false,
      status: 'INVALID_INPUT',
      checkedPathCount: 0,
      matchedPathColumn: '',
      candidateCount: 0,
      pathId: '',
      fileId: '',
      path: '',
      filename: input.filename || '',
      note: 'RootID, candidate path, and filename are required.'
    };
  }

  var checked = 0;
  var firstPathEvidence = null;
  var firstPathMissing = null;

  for (var i = 0; i < input.candidates.length; i++) {
    var candidate = input.candidates[i];
    checked++;

    var folderResult = findFolderByPath_(input.rootId, candidate.path);

    if (folderResult.status === 'AMBIGUOUS') {
      return {
        exists: false,
        status: 'AMBIGUOUS',
        checkedPathCount: checked,
        matchedPathColumn: candidate.columnLetter,
        candidateCount: 0,
        pathId: folderResult.pathId || '',
        fileId: '',
        path: folderResult.matchedPath || candidate.path,
        filename: input.filename,
        note: folderResult.note
      };
    }

    if (folderResult.status !== 'FOUND') {
      if (!firstPathMissing) {
        firstPathMissing = {
          columnLetter: candidate.columnLetter,
          path: candidate.path,
          note: folderResult.note || ''
        };
      }
      continue;
    }

    if (!firstPathEvidence) {
      firstPathEvidence = {
        columnLetter: candidate.columnLetter,
        folder: folderResult.folder,
        pathId: folderResult.pathId,
        path: folderResult.matchedPath || candidate.path
      };
    }

    var fileResult = findExactFileInFolder_(folderResult.folder, input.filename);

    if (fileResult.status === 'AMBIGUOUS') {
      return {
        exists: false,
        status: 'AMBIGUOUS',
        checkedPathCount: checked,
        matchedPathColumn: candidate.columnLetter,
        candidateCount: fileResult.count,
        pathId: folderResult.pathId,
        fileId: '',
        path: folderResult.matchedPath || candidate.path,
        filename: input.filename,
        note: 'Ambiguous file exact match in path.'
      };
    }

    if (fileResult.status === 'FOUND') {
      return {
        exists: true,
        status: 'RESOLVED',
        checkedPathCount: checked,
        matchedPathColumn: candidate.columnLetter,
        candidateCount: 1,
        pathId: folderResult.pathId,
        fileId: fileResult.file.getId(),
        path: folderResult.matchedPath || candidate.path,
        filename: input.filename,
        note: ''
      };
    }
  }

  var rootExact = findExactFilesUnderRoot_(input.rootId, input.filename, 2);

  if (rootExact.status === 'FOUND') {
    return {
      exists: true,
      status: 'RESOLVED',
      checkedPathCount: checked,
      matchedPathColumn: '',
      candidateCount: 1,
      pathId: rootExact.matches[0].pathId,
      fileId: rootExact.matches[0].fileId,
      path: rootExact.matches[0].path,
      filename: input.filename,
      note: 'Exact filename found in a different path under RootID.'
    };
  }

  if (rootExact.status === 'AMBIGUOUS') {
    return {
      exists: false,
      status: 'AMBIGUOUS',
      checkedPathCount: checked,
      matchedPathColumn: firstPathEvidence ? firstPathEvidence.columnLetter : '',
      candidateCount: rootExact.count,
      pathId: firstPathEvidence ? firstPathEvidence.pathId : '',
      fileId: '',
      path: firstPathEvidence ? firstPathEvidence.path : '',
      filename: input.filename,
      note: 'Exact filename found in multiple paths under RootID. Human confirmation required.'
    };
  }

  if (firstPathEvidence) {
    var fileSuggestions = findSimilarFilesInFolder_(
      firstPathEvidence.folder,
      input.filename,
      firstPathEvidence.path
    );
    return {
      exists: false,
      status: 'PATH_FOUND_FILE_MISSING',
      checkedPathCount: checked,
      matchedPathColumn: firstPathEvidence.columnLetter,
      candidateCount: fileSuggestions.length,
      pathId: firstPathEvidence.pathId,
      fileId: '',
      path: firstPathEvidence.path,
      filename: input.filename,
      note: buildFileMissingNote_(fileSuggestions, true)
    };
  }

  var suggestions = findSuggestionsUnderRoot_(input.rootId, input.candidates, input.filename);

  return {
    exists: false,
    status: 'PATH_NOT_FOUND',
    checkedPathCount: checked,
    matchedPathColumn: '',
    candidateCount: suggestions.pathSuggestions.length + suggestions.fileSuggestions.length,
    pathId: '',
    fileId: '',
    path: firstPathMissing ? firstPathMissing.path : '',
    filename: input.filename,
    note: buildPathNotFoundNote_(suggestions)
  };
}

function findExactFilesUnderRoot_(rootId, filename, maxMatches) {
  var matches = [];
  var query = "trashed = false and title = '" + escapeDriveQueryValue_(filename) + "'";
  var files;

  try {
    files = DriveApp.searchFiles(query);
  } catch (err) {
    return { status: 'NOT_FOUND', matches: [], count: 0 };
  }

  while (files.hasNext() && matches.length < maxMatches) {
    var file = files.next();
    var location = getFileLocationUnderRoot_(file, rootId);
    if (!location) continue;

    matches.push({
      fileId: file.getId(),
      pathId: location.pathId,
      path: location.path,
      filename: file.getName()
    });
  }

  if (matches.length > 1) {
    return { status: 'AMBIGUOUS', matches: matches, count: matches.length };
  }

  if (matches.length === 1) {
    return { status: 'FOUND', matches: matches, count: 1 };
  }

  return { status: 'NOT_FOUND', matches: [], count: 0 };
}

function findSimilarFilesInFolder_(folder, filename, folderPath) {
  var extension = getLowerExtension_(filename);
  var targetBase = getFilenameBase_(filename);
  var candidates = searchFileCandidates_(filename, folder.getId());
  var suggestions = [];

  for (var i = 0; i < candidates.length; i++) {
    var candidateName = candidates[i].getName();
    if (extension && getLowerExtension_(candidateName) !== extension) continue;

    var score = similarityScore_(targetBase, getFilenameBase_(candidateName));
    if (score >= RESOLVE_SUGGESTION_MIN_SIMILARITY) {
      suggestions.push({
        name: candidateName,
        path: folderPath || '',
        score: score
      });
    }
  }

  return sortAndLimitSuggestions_(suggestions);
}

function findSuggestionsUnderRoot_(rootId, candidates, filename) {
  var pathSuggestions = findPathSuggestionsByDriveSearch_(rootId, candidates);
  var fileSuggestions = findFileSuggestionsByDriveSearch_(rootId, filename);

  return {
    pathSuggestions: pathSuggestions,
    fileSuggestions: fileSuggestions
  };
}

function findPathSuggestionsByDriveSearch_(rootId, candidates) {
  var candidatePaths = candidates.map(function(candidate) {
    return candidate.path || '';
  }).filter(function(path) {
    return !!path;
  });

  var terms = [];
  for (var i = 0; i < candidatePaths.length; i++) {
    var segments = splitPathSegments_(candidatePaths[i]);
    var searchSeed = segments.length
      ? segments[segments.length - 1]
      : candidatePaths[i];
    terms = terms.concat(getDriveSearchTerms_(searchSeed));
  }
  terms = uniqueLimitedTerms_(terms, RESOLVE_SEARCH_MAX_TERMS);

  var folders = searchFolderCandidates_(terms);
  var suggestions = [];

  for (var f = 0; f < folders.length; f++) {
    var location = getFolderLocationUnderRoot_(folders[f], rootId);
    if (!location) continue;

    for (var p = 0; p < candidatePaths.length; p++) {
      var score = similarityScore_(candidatePaths[p], location.path);
      if (score >= RESOLVE_SUGGESTION_MIN_SIMILARITY) {
        suggestions.push({
          name: location.path,
          path: location.path,
          score: score
        });
      }
    }
  }

  return sortAndLimitSuggestions_(dedupeSuggestionItems_(suggestions));
}

function findFileSuggestionsByDriveSearch_(rootId, filename) {
  var extension = getLowerExtension_(filename);
  var targetBase = getFilenameBase_(filename);
  var candidates = searchFileCandidates_(filename, '');
  var suggestions = [];

  for (var i = 0; i < candidates.length; i++) {
    var file = candidates[i];
    var candidateName = file.getName();
    if (extension && getLowerExtension_(candidateName) !== extension) continue;

    var location = getFileLocationUnderRoot_(file, rootId);
    if (!location) continue;

    var score = similarityScore_(targetBase, getFilenameBase_(candidateName));
    if (score >= RESOLVE_SUGGESTION_MIN_SIMILARITY) {
      suggestions.push({
        name: candidateName,
        path: location.path,
        score: score
      });
    }
  }

  return sortAndLimitSuggestions_(dedupeSuggestionItems_(suggestions));
}

function searchFileCandidates_(filename, parentId) {
  var terms = getDriveSearchTerms_(getFilenameBase_(filename));
  terms = uniqueLimitedTerms_(terms, RESOLVE_SEARCH_MAX_TERMS);

  var found = {};
  var results = [];

  for (var i = 0; i < terms.length; i++) {
    var queryParts = [
      'trashed = false',
      "title contains '" + escapeDriveQueryValue_(terms[i]) + "'"
    ];

    if (parentId) {
      queryParts.push('\'' + escapeDriveQueryValue_(parentId) + '\' in parents');
    }

    var iterator;
    try {
      iterator = DriveApp.searchFiles(queryParts.join(' and '));
    } catch (err) {
      continue;
    }

    while (iterator.hasNext() && results.length < RESOLVE_SEARCH_MAX_CANDIDATES) {
      var file = iterator.next();
      var id = file.getId();
      if (found[id]) continue;
      found[id] = true;
      results.push(file);
    }

    if (results.length >= RESOLVE_SEARCH_MAX_CANDIDATES) break;
  }

  return results;
}

function searchFolderCandidates_(terms) {
  var found = {};
  var results = [];

  for (var i = 0; i < terms.length; i++) {
    var query = "trashed = false and title contains '" +
      escapeDriveQueryValue_(terms[i]) + "'";
    var iterator;

    try {
      iterator = DriveApp.searchFolders(query);
    } catch (err) {
      continue;
    }

    while (iterator.hasNext() && results.length < RESOLVE_SEARCH_MAX_CANDIDATES) {
      var folder = iterator.next();
      var id = folder.getId();
      if (found[id]) continue;
      found[id] = true;
      results.push(folder);
    }

    if (results.length >= RESOLVE_SEARCH_MAX_CANDIDATES) break;
  }

  return results;
}

function getDriveSearchTerms_(text) {
  var normalized = normalizeComparableText_(text);
  if (!normalized) return [];

  return normalized.split(' ').filter(function(term) {
    return term.length >= 3;
  }).sort(function(a, b) {
    return b.length - a.length;
  });
}

function uniqueLimitedTerms_(terms, limit) {
  var seen = {};
  var result = [];

  for (var i = 0; i < terms.length; i++) {
    var term = String(terms[i] || '').toLowerCase();
    if (!term || seen[term]) continue;
    seen[term] = true;
    result.push(term);
    if (result.length >= limit) break;
  }

  return result;
}

function getFileLocationUnderRoot_(file, rootId) {
  var parents = file.getParents();

  while (parents.hasNext()) {
    var location = getFolderLocationUnderRoot_(parents.next(), rootId);
    if (location) return location;
  }

  return null;
}

function getFolderLocationUnderRoot_(folder, rootId) {
  var queue = [{ folder: folder, segments: [folder.getName()] }];
  var visited = {};
  var checked = 0;
  var maxChecked = 200;

  while (queue.length && checked < maxChecked) {
    var entry = queue.shift();
    var id = entry.folder.getId();
    if (visited[id]) continue;
    visited[id] = true;
    checked++;

    if (id === rootId) {
      var segments = entry.segments.slice(0, -1).reverse();
      return {
        pathId: folder.getId(),
        path: segments.join('\\')
      };
    }

    var parents = entry.folder.getParents();
    while (parents.hasNext()) {
      var parent = parents.next();
      queue.push({
        folder: parent,
        segments: entry.segments.concat([parent.getName()])
      });
    }
  }

  return null;
}

function dedupeSuggestionItems_(suggestions) {
  var seen = {};
  var result = [];

  for (var i = 0; i < suggestions.length; i++) {
    var item = suggestions[i];
    var key = item.name + '\n' + item.path;
    if (seen[key]) continue;
    seen[key] = true;
    result.push(item);
  }

  return result;
}

function escapeDriveQueryValue_(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

function buildFileMissingNote_(fileSuggestions, inMatchedPath) {
  var note = inMatchedPath
    ? 'Exact file not found in matched path.'
    : 'Exact file not found.';

  if (fileSuggestions && fileSuggestions.length) {
    note += ' Similar file candidates: ' + formatSuggestionList_(fileSuggestions) + '.';
  }

  return note;
}

function buildPathNotFoundNote_(suggestions) {
  var note = 'Exact path not found.';

  if (suggestions.pathSuggestions.length) {
    note += ' Similar path candidates: ' + formatSuggestionList_(suggestions.pathSuggestions) + '.';
  }

  if (suggestions.fileSuggestions.length) {
    note += ' Similar file candidates: ' + formatSuggestionList_(suggestions.fileSuggestions) + '.';
  }

  return note;
}

function formatSuggestionList_(suggestions) {
  return suggestions.map(function(item) {
    var percent = Math.round(item.score * 100);
    var location = item.path ? ' @ ' + item.path : '';
    return item.name + location + ' (' + percent + '%)';
  }).join(' | ');
}

function sortAndLimitSuggestions_(suggestions) {
  return suggestions.sort(function(a, b) {
    return b.score - a.score;
  }).slice(0, RESOLVE_SUGGESTION_MAX_ITEMS);
}

function getLowerExtension_(filename) {
  var text = String(filename || '');
  var index = text.lastIndexOf('.');
  if (index < 0 || index === text.length - 1) return '';
  return text.slice(index + 1).toLowerCase();
}

function getFilenameBase_(filename) {
  var text = String(filename || '');
  var index = text.lastIndexOf('.');
  if (index < 0) return text;
  return text.slice(0, index);
}

function normalizeComparableText_(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\\/_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarityScore_(a, b) {
  var left = normalizeComparableText_(a);
  var right = normalizeComparableText_(b);

  if (!left || !right) return 0;
  if (left === right) return 1;

  var maxLength = Math.max(left.length, right.length);
  if (!maxLength) return 1;

  var distance = levenshteinDistance_(left, right);
  return Math.max(0, 1 - (distance / maxLength));
}

function levenshteinDistance_(a, b) {
  var previous = [];
  var current = [];
  var i;
  var j;

  for (j = 0; j <= b.length; j++) {
    previous[j] = j;
  }

  for (i = 1; i <= a.length; i++) {
    current[0] = i;
    for (j = 1; j <= b.length; j++) {
      var insertCost = current[j - 1] + 1;
      var deleteCost = previous[j] + 1;
      var replaceCost = previous[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1);
      current[j] = Math.min(insertCost, deleteCost, replaceCost);
    }
    previous = current;
    current = [];
  }

  return previous[b.length];
}
