const fs = require("fs");
const path = require("path");
const vm = require("vm");

function Module(id) {
  this.id = id;
  this.exports = {};
}

Module.funcWrap = [
  `(function(exports,require,module,__filename,__dirname){`,
  `})`,
];

Module._extensions = {
  ".js"(module) {
    let content = fs.readFileSync(module.id, "utf8");
    content = `${Module.funcWrap[0]}${content}${Module.funcWrap[1]}`;
    let func = vm.runInThisContext(content);
    const exports = module.exports;
    const dirname = path.dirname(module.id);
    const thisValue = module.exports;
    func.call(thisValue, exports, Require, module, module.id, dirname);
  },
  ".json"(module) {
    let content = fs.readFileSync(module.id, "utf8");
    module.exports = JSON.parse(content);
  },
};
Module._resolveFilename = function (filename) {
  let absFilePath = path.resolve(__dirname, filename);
  // 检测引入时传入后缀情况
  let isExists = fs.existsSync(absFilePath);
  if (isExists) {
    return absFilePath;
  } else {
    let extensions = Object.keys(Module._extensions);
    for (let ext of extensions) {
      // 尝试拼接后缀
      let absPathAndExt = absFilePath + ext;
      if (fs.existsSync(absPathAndExt)) {
        return absPathAndExt;
      }
    }
    // 所有后缀情况拼接失败，抛出错误
    throw new Error("module not exists");
  }
};

// 1. 获取后缀名
// 2. 执行该后缀名的对应处理函数
Module.prototype.load = function () {
  // extname 可以获取路径的后缀名
  const ext = path.extname(this.id);
  Module._extensions[ext](this);
};

Module._cache = {};

// 为了与nodejs做区分
function Require(filename) {
  filename = Module._resolveFilename(filename);
  const cacheModule = Module._cache[filename];
  if (cacheModule) {
    return cacheModule.exports;
  }
  const module = new Module(filename);
  Module._cache[filename] = module;
  module.load();
  return module.exports;
}
const a = Require("./a");
console.log(a);
