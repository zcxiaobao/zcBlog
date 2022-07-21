// const util = require("util");
// const fs = require("fs");
// const ejs = require("ejs");

// // const readFile = util.promisify(fs.readFile);

// // 渲染成大佬列表
// const users = [
//   { name: "摸鱼的春哥", url: "https://juejin.cn/user/1714893870865303" },
//   { name: "19组清风", url: "https://juejin.cn/user/307518987049112" },
//   { name: "翊君", url: "https://juejin.cn/user/2964698339501816" },
//   { name: "南方者", url: "https://juejin.cn/user/2840793779295133" },
// ];

// let ringleader = "<ul>";
// users.forEach((user) => {
//   ringleader += `<li><a href="${user.url}">${user.name}</a></li>`;
// });
// ringleader += "</ul>";

// console.log(ringleader);

// // const str = ejs.render(
// //   `<ul>
// //     <% users.forEach(function(user){ %>
// //         <li>
// //             <a href=<%= user.url %> > <%= user.name %> </a>
// //         </li>
// //     <% }); %>
// // </ul>`,
// //   { users: users }
// // );

// // console.log(str);

// // `
// // <ul>
// //     <li v-for="user in users" :key="user.url">
// //         <a :href="user.url"> {{user.name}} </a>
// //     </li>
// // </ul>
// // `;

// (async function () {
//   let r = await ejs.renderFile("./demo.html", { users });
//   console.log(r);
// })();

// const ejs = require("ejs");
const util = require("util");
const fs = require("fs");
const users = [
  { name: "摸鱼的春哥", url: "https://juejin.cn/user/1714893870865303" },
  { name: "19组清风", url: "https://juejin.cn/user/307518987049112" },
  { name: "翊君", url: "https://juejin.cn/user/2964698339501816" },
  { name: "南方者", url: "https://juejin.cn/user/2840793779295133" },
  { name: "冴羽", url: "https://juejin.cn/user/712139234359182" },
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
  let r = await ejs.renderFile("./demo.html", {
    users,
    name: "zcxiaobao",
    age: 18,
  });
  console.log(r);
})();
