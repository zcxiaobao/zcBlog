// Promise 三种状态
const PENDING = "PENDING";
const FULFILLED = "FULFILLED";
const REJECTED = "REJECTED";

// 判断x 是不是一个promise 是promise就采用他的状态，如果解析后还是promise会递归解析
function resolvePromise(promise, x, resolve, reject) {
  // x可能是别人家的promise
  // 用 x 的值来决定 promise 走 resolve还是 reject
  // 核心就是用 x 来处理 promise 是成功还是失败
  // 1. x 是普通值
  // 2. x 是基于 Promises/A+ 规范的promise
  // 3. x 是基于其他规范的promise
  // 我们要考虑不同人写的promise可以互相兼容，所以这里要按照规范来实现，保证promise直接可以互相调用

  // 循环引用，自己等待自己完成，抛出 TypeError 错误
  if (promise == x) {
    return reject(
      new TypeError(
        `TypeError: Chaining cycle detected for promise #<Promise> `
      )
    );
  }
  // 判断x 是不是一个promise， 如果不是promise，则直接用这个值将promise变成成功态即可
  // 判断 x 是否为对象(排除null情况)或函数
  if ((typeof x === "object" && x !== null) || typeof x === "function") {
    let called = false;
    try {
      // 检索 x.then 可能会抛出异常
      // 例如x可能是通过defineProperty定义的then
      let then = x.then;
      if (typeof then === "function") {
        // 这已经最小判断，满足此条件后，认定为 promise 实例
        // 执行 x.then 会再次检索 then 属性，有风险发生错误
        then.call(
          x,
          (y) => {
            // 这个then方法可能是别人家的promise, 没有处理同时调用成功和失败方法
            if (called) return;
            called = true;
            resolvePromise(promise, y, resolve, reject); //递归解析y的值
          },
          (r) => {
            if (called) return;
            called = true;
            // 一旦失败了 就不在解析失败的结果了
            reject(r);
          }
        );
      } else {
        // {} / function 没有then方法 依旧是普通值  {then:123}
        resolve(x);
      }
    } catch (e) {
      if (called) return;
      called = true;
      reject(e);
    }
  } else {
    // 不是对象和函数 普通值
    resolve(x);
  }
}
class Promise {
  constructor(executor) {
    this.status = PENDING; // promise的默认状态
    this.value = undefined; // 成功的值和失败的原因
    this.reason = undefined;

    this.onResolvedCallbacks = []; // 这里存放所有成功的回调
    this.onRejectedCallbacks = []; // 所有失败的回调
    const resolve = (value) => {
      if (this.status == PENDING) {
        this.value = value;
        this.status = FULFILLED;
        this.onResolvedCallbacks.forEach((cb) => cb(this.value));
      }
    };
    const reject = (reason) => {
      if (this.status === PENDING) {
        this.reason = reason;
        this.status = REJECTED;
        this.onRejectedCallbacks.forEach((cb) => cb(this.reason));
      }
    };
    try {
      executor(resolve, reject); // executor就是执行器立刻执行，出错就调用reject
    } catch (e) {
      reject(e);
    }
  }
  then(onFulfilled, onRejected) {
    // 调用then的时候会判断是成功还是失败
    // 可以不停的then下去
    onFulfilled = typeof onFulfilled === "function" ? onFulfilled : (v) => v;
    onRejected =
      typeof onRejected === "function"
        ? onRejected
        : (e) => {
            throw e;
          };
    let promise2 = new Promise((resolve, reject) => {
      // x是一个普通值 则将这个值直接传入到resolve函数中即可
      if (this.status === FULFILLED) {
        setTimeout(() => {
          try {
            let x = onFulfilled(this.value);
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });
      }
      if (this.status === REJECTED) {
        setTimeout(() => {
          try {
            let x = onRejected(this.reason);
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });
      }
      if (this.status == PENDING) {
        // 发布订阅  有可能调用then的时候没成功也没失败，我就将回调存起来，稍后根据用户调用的方法在进行执行
        this.onResolvedCallbacks.push(() => {
          setTimeout(() => {
            try {
              let x = onFulfilled(this.value);
              resolvePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          });
        });
        this.onRejectedCallbacks.push(() => {
          setTimeout(() => {
            try {
              let x = onRejected(this.reason);
              resolvePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          });
        });
      }
    });
    return promise2;
  }
}
Promise.deferred = function () {
  let dfd = {};
  dfd.promise = new Promise((resolve, reject) => {
    dfd.resolve = resolve;
    dfd.reject = reject;
  });
  return dfd;
};

module.exports = Promise;
