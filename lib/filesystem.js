(function() {
  var Filesystem, UINT64, fs, path;

  fs = require('fs');

  path = require('path');

  UINT64 = require('cuint').UINT64;

  Filesystem = (function() {
    function Filesystem(src) {
      this.src = path.resolve(src);
      this.header = {
        files: {}
      };
      this.offset = UINT64(0);
    }

    Filesystem.prototype.searchNodeFromDirectory = function(p) {
      var dir, dirs, i, json, len;
      json = this.header;
      dirs = p.split(path.sep);
      for (i = 0, len = dirs.length; i < len; i++) {
        dir = dirs[i];
        if (dir !== '.') {
          json = json.files[dir];
        }
      }
      return json;
    };

    Filesystem.prototype.searchNodeFromPath = function(p) {
      var base, name, node;
      p = path.relative(this.src, p);
      if (!p) {
        return this.header;
      }
      name = path.basename(p);
      node = this.searchNodeFromDirectory(path.dirname(p));
      if (node.files == null) {
        node.files = {};
      }
      if ((base = node.files)[name] == null) {
        base[name] = {};
      }
      return node.files[name];
    };

    Filesystem.prototype.insertDirectory = function(p, shouldUnpack) {
      var node;
      node = this.searchNodeFromPath(p);
      if (shouldUnpack) {
        node.unpacked = shouldUnpack;
      }
      return node.files = {};
    };

    Filesystem.prototype.insertFile = function(p, shouldUnpack, stat) {
      var dirNode, node;
      dirNode = this.searchNodeFromPath(path.dirname(p));
      node = this.searchNodeFromPath(p);
      if (shouldUnpack || dirNode.unpacked) {
        node.size = stat.size;
        node.unpacked = true;
        return;
      }
      if (stat.size > 4294967295) {
        throw new Error(p + ": file size can not be larger than 4.2GB");
      }
      node.size = stat.size;
      node.offset = this.offset.toString();
      if (process.platform !== 'win32' && stat.mode & 0x40) {
        node.executable = true;
      }
      return this.offset.add(UINT64(stat.size));
    };

    Filesystem.prototype.insertLink = function(p, stat) {
      var link, node;
      link = path.relative(fs.realpathSync(this.src), fs.realpathSync(p));
      if (link.substr(0, 2) === '..') {
        throw new Error(p + ": file links out of the package");
      }
      node = this.searchNodeFromPath(p);
      return node.link = link;
    };

    Filesystem.prototype.listFiles = function() {
      var files, fillFilesFromHeader;
      files = [];
      fillFilesFromHeader = function(p, json) {
        var f, fullPath, results;
        if (!json.files) {
          return;
        }
        results = [];
        for (f in json.files) {
          fullPath = path.join(p, f);
          files.push(fullPath);
          results.push(fillFilesFromHeader(fullPath, json.files[f]));
        }
        return results;
      };
      fillFilesFromHeader('/', this.header);
      return files;
    };

    Filesystem.prototype.getNode = function(p) {
      var name, node;
      node = this.searchNodeFromDirectory(path.dirname(p));
      name = path.basename(p);
      if (name) {
        return node.files[name];
      } else {
        return node;
      }
    };

    Filesystem.prototype.getFile = function(p, followLinks) {
      var info;
      if (followLinks == null) {
        followLinks = true;
      }
      info = this.getNode(p);
      if (info.link && followLinks) {
        return this.getFile(info.link);
      } else {
        return info;
      }
    };

    return Filesystem;

  })();

  module.exports = Filesystem;

}).call(this);
