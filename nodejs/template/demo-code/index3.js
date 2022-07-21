// const ejs = require("ejs");
const util = require("util");
const fs = require("fs");
const users = [
  { name: "摸鱼的春哥", url: "https://juejin.cn/user/1714893870865303" },
  { name: "19组清风", url: "https://juejin.cn/user/307518987049112" },
  { name: "翊君", url: "https://juejin.cn/user/2964698339501816" },
  { name: "南方者", url: "https://juejin.cn/user/2840793779295133" },
];

const readFile = util.promisify(fs.readFile);
const ejs = {
  async renderFile(filename, options) {
    let content = await readFile(filename, "utf8");

    content = content.replace(/<%=(.+?)%>/g, function () {
      return "${" + arguments[1] + "}";
    });
    let head = 'let str = "";\n with(obj){ \n str+= `';

    let body = content.replace(/<%(.+?)%>/g, function () {
      return "`\n" + arguments[1] + "\n str += `";
    });
    let tail = "`} \nreturn str";
    let fn = new Function("obj", head + body + tail);
    return fn(options);
  },
};

(async function () {
  let r = await ejs.renderFile("./template3.html", { users });
  console.log(r);
})();
