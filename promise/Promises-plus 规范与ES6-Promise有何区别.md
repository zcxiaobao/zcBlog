---
theme: v-green
---

## 前言

`Promise` 是一种优秀的异步解决方案，其原生实现更是面试中的爆点，提到 `Promise` 实现，我们首先会想起 `Promises/A+` 规范，大多数教程中都是按照 `Promises/A+` 规范来实现 `Promise` 。

小包也是 `Promises/A+` 圣经的执行者之一，但小包心中一直有个好奇，遵循 `Promises/A+` 规范实现的 `Promise` 与 `ES6-Promise` 能有什么区别呐？

> 文章中的测试代码选取小包[基于 Promises/A+ 规范实现的原生 Promise](https://github.com/zcxiaobao/zcBlog/tree/main/promise/MyPromise)

**学习本文，你能收获**:

- 进一步完善原生 `Promise` 的实现
- 更进一步理解 `Promise` 与 `microTask` 之间的关系

## promise 的成功值 value

`Promises/A+` 规范只提供了 `value` 的定义，并没有详细说明如何处理不同类型的 `value` 值:

> “value” is any legal JavaScript value (including `undefined`, a thenable, or a promise).
> <br> value 可以是任意合法的 JavaScript 值，包括 undefined、具备 then 接口的对象或者 promise

但 [ECMAScript 规范](https://262.ecma-international.org/6.0/#sec-promise-resolve-functions)对不同类型的 `value` 做了细致的处理。

![es6-promise-value.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/64cb4ae07c1e4708ad92dacffa192f53~tplv-k3u1fbpfcp-watermark.image?)

红框部分我们可以看出，`ES6` 规范会根据 `resolution`(相当于 Promises/A+ 规范中的 value)类型选取不同的执行方案。

- 判断 `resolution` 是否为 `Object`，如果不是，直接执行 `FulfillPromise`
- 如果是 `Object`，试探是否存在 `then` 接口
- 判断 `then` 是否可执行 (abrupt completion 可以理解为非正常值)
- 如果 `then` 可执行，将 `then` 方法放入事件队列中。

> PromiseResolveThenableJob: 该 job 使用传入的 thenable 的 then 方法来解决 promise。

一句话总结上面的过程: 如果 `value` 值为**可 thenable 对象或者 promise**，`ES6` 会采用该 `thenable` 的状态。

小包举个栗子：

```js
const p = new Promise((resolve) => {
  resolve(1);
});

const p1 = new Promise((resolve) => {
  resolve(p);
});
p1.then((d) => console.log(d));
```

p1 接收的成功值 value 为 Promise p，p 状态为 fulfilled ，这种情况下 ES6 中会采取 p 的状态及 value，因此最终打印 `1`。

我们将 p 更换为具备 `thenable` 对象，结果也是类似的。

```js
// 类 promise 对象
const p1 = {
  a: 1,
  then(onFulfilled, onReject) {
    onFulfilled(this.a);
  },
};

const p2 = new Promise((resolve) => {
  resolve(p1);
});
// 1
p2.then((d) => console.log(d));
```

`Promises/A+` 没有对此进行规范，因此当传入的 `value` 为 `thenable` 对象时，会原封不动的输出。

![aplus-promise.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fb5c8578e8ed45ae9c1123f0972044fa~tplv-k3u1fbpfcp-watermark.image?)

那我们应该如何完善这部分代码呐？我们需要对 `value` 值进行解析 ，如果 `value` 可 `thenable` ，则采纳他的状态和值，递归进行上述步骤，直至 `value` 不可 `thenable`。(这里与 resolvePromise 部分递归解析 onFulfilled 函数的返回值是类似的)

```js
const resolve = (value) => {
  if (typeof value === "object" && value != null) {
    try {
      const then = value.then;
      if (typeof then === "function") {
        return then.call(value, resolve, reject);
      }
    } catch (e) {
      return reject(e);
    }
  }
  if (this.status === PENDING) {
    this.value = value;
    this.status = FULFILLED;
    this.onFulfilledCallbacks.forEach((cb) => cb(this.value));
  }
};
```

### Promise 与 microTask

`Promises/A+` 规范中其实并没有将 `Promise` 对象与 `microTask` 挂钩，规范是这么说的:

> Here “platform code” means engine, environment, and promise implementation code. In practice, this requirement ensures that `onFulfilled` and `onRejected` execute asynchronously, after the event loop turn in which `then` is called, and with a fresh stack. This can be implemented with either a `“macro-task”` mechanism such as [`setTimeout`](https://html.spec.whatwg.org/multipage/webappapis.html#timers) or [`setImmediate`](https://dvcs.w3.org/hg/webperf/raw-file/tip/specs/setImmediate/Overview.html#processingmodel), or with a `“micro-task”` mechanism such as [`MutationObserver`](https://dom.spec.whatwg.org/#interface-mutationobserver) or [`process.nextTick`](https://nodejs.org/api/process.html#process_process_nexttick_callback). Since the promise implementation is considered platform code, it may itself contain a task-scheduling queue or “trampoline” in which the handlers are called.

`Promises/A+` 规范中表示 `then` 方法可以通过 `setTimeout` 或 `setImediate` 等宏任务机制实现，也可以通过 `MutationObserver` 或 `process.nextTick` 等微任务机制实现。

但经过大量面试题洗礼的我们知道浏览器中的 `Promise.then` 典型的微任务。既然都学到这里了，小包索性就打破砂锅问到底，找到 `Promise` 与 `microTask` 挂钩的根源。

### 谁规定了 Promise 是 microTask

> 标准读起来属实有些无聊，但好在小包找到了最终的答案。

首先小包先入为主的以为，`Promise` 的详细规定应该都位于 [ECMAScript](https://tc39.es/ecma262/) 制定的规范中，但当小包进入标准后，全局搜索 `micro` ，竟然只搜索到三个 `Microsoft`。讲实话，小包是震惊的，**ECMAScript 并没有规定 Promise 是 microTask**。

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8710a5c724104626ae5140826c5a0a37~tplv-k3u1fbpfcp-watermark.image?)

`ECMAScript` 规范中，最接近的是下面两段表达：

> The [host-defined](https://tc39.es/ecma262/#host-defined) abstract operation **HostEnqueuePromiseJob** takes arguments `job` (a [Job](https://tc39.es/ecma262/#job) [Abstract Closure](https://tc39.es/ecma262/#sec-abstract-closure)) and `realm` (a [Realm Record](https://tc39.es/ecma262/#realm-record) or null) and returns unused. It schedules `job` to be performed at some future time. The [Abstract Closures](https://tc39.es/ecma262/#sec-abstract-closure) used with this algorithm are intended to be related to the handling of Promises, or otherwise, to be scheduled with equal priority to Promise handling operations.

> Jobs are scheduled for execution by ECMAScript host environments. This specification describes the host hook HostEnqueuePromiseJob to schedule one kind of job; hosts may define additional abstract operations which schedule jobs. Such operations accept a Job Abstract Closure as the parameter and schedule it to be performed at some future time. Their implementations must conform to the following requirements:

上面两句话意思大约是: `ECMAScript` 中将 `Promise` 看作一个 job(作业)，`HostEnqueuePromiseJob` 是用来调度 `Promise` 作业的方法，这个方法会在未来某个时间段执行，具体执行与 `Promise` 的处理函数或者与 `Promise` 处理操作相同的优先级有关。

那何处将 `Promise` 规定为 `microTask` 呐？--- [**HTML 标准**](<https://html.spec.whatwg.org/multipage/webappapis.html#hostensurecancompilestrings(realm)>)

`HTML` 标准中指出:

> JavaScript contains an [implementation-defined](https://infra.spec.whatwg.org/#implementation-defined) [HostEnqueuePromiseJob](https://tc39.es/ecma262/#sec-hostenqueuepromisejob)(`job`, `realm`) abstract operation to schedule Promise-related operations. HTML schedules these operations in the **microtask queue**.

上述标准的最后一句话指出，`HTML` 将在 `micro queue` 中安排这些操作。

## 后语

我是  **战场小包** ，一个快速成长中的小前端，希望可以和大家一起进步。

如果喜欢小包，可以在  **[掘金](https://juejin.cn/user/4424090519078430)**  关注我，同样也可以关注我的小小公众号——**[小包学前端](https://zcxiaobao.gitee.io/wx-demo/wx.png)**。

一路加油，冲向未来!!!

## 疫情早日结束 人间恢复太平
