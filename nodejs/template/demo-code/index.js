// const ejs = require("ejs");
const util = require("util");
const fs = require("fs");

const readFile = util.promisify(fs.readFile);
const ejs = {
  async renderFile(filename, options) {
    let content = await readFile(filename, "utf8");
    content = content.replace(/<%=(.+?)%>/g, function () {
      return options[arguments[1]];
    });
    return content;
  },
};

(async function () {
  let r = await ejs.renderFile("./template.html", { name: "zc", age: 18 });
  console.log(r);
})();
