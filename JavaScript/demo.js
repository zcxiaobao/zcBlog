function compileCode(code) {
  code = "with (ctx) {" + code + "}";
  return new Function("ctx", code);
}

const whiteList = ["Math", "console"];
function ctxProxy(ctx) {
  const exposeCtx = new Proxy(ctx, {
    // 拦截变量
    has(target, key) {
      if (whiteList.includes(key)) {
        // 在白名单列表中，往上访问
        return target[key];
      }
      // 如果不是自身属性，说明找不到该属性，未避免去上层作用域链查找，抛出异常
      if (!target.hasOwnProperty(key)) {
        throw new Error(`Invalid expression - ${key}! You can not do that!`);
      }
      return true;
    },
  });
  return exposeCtx;
}

function sandbox(code, ctx) {
  let exposeCtx = ctxProxy(ctx);
  // 将 this 也指向手动代理后的对象
  compileCode(code).call(exposeCtx, exposeCtx);
}

const ctx = {
  a: {
    b: "b",
  },
};
// 待执行程序
const code = `
  a.b.__proto__.toString = () => {
    new (() => {}).constructor("console.log('Eascpe')")()
  };
console.log('123'.toString())
`;

sandbox(code, ctx);
