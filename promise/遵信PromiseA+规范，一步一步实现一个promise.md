## 前言

> 满打满算，小包写文也 4 个多月了，2 月没找到状态，也正好沉淀了一下自己，反思了前面几月的写文历程，文章写的很乱，也背离了最初的写文计划。因此小包决定拨乱反正，后续文章暂时**以 `JavaScript` 或者 `ES6` 方向**为主，编写小包认为**重要的、新颖的或者小包有独特看法**的一些特性或使用。

本周写文的核心为 `Promise` ，`Promise` 大家应该都特别熟悉了，`Promise` 是异步编程的一种解决方案，广泛用在日常编程中。本周小包将围绕 `Promise` 源码手写进行写文，源码手写初步计划使用三篇文章实现—— 手写 `Promise` 之基础篇，手写 `Promise` 之 `resolvePromise` 篇，手写 `Promise` 之静态方法篇。

[Promises/A+](https://promisesaplus.com/) 规范是 `Promise` 的实现准则，因此 `Promise` 手写系列将遵循 `Promises/A+` 规范的思路，以案例和提问方式层层深入，一步一步实现 `Promise` 封装。

学习本文，你能收获:

- 🌟 理解 `Promise A+`规范
- 🌟 理解什么是 `Promise` 的值穿透、`Promise` 链式调用机制、`Promise` 注册多个 `then` 方法等。
- 🌟 掌握 `Promise` 源码编写全过程
- 🌟 掌握发布订阅模式在 `Promise` 源码编写中的使用

## 基础铺垫

`Promise` 必定处于下列三种状态之一:

- `Pending` 等待态: 初始状态，不是成功或失败状态。
- `Fulfilled` 完成态: 意味着操作成功完成。
- `Rejected` 失败态: 意味着操作成功失败。
- 当 `promise` 处于 `Pending` 状态时，可以转变为 `Fulfilled` 或者 `Rejected`
  > 当 `promise` 处于 `Fulfilled` 或 `Rejected` 时，状态不能再发生改变

那什么会触发 `promise` 中状态的改变呐？我们来看几个栗子:

```js
// p1 什么都不执行且传入空函数
const p1 = new Promise(() => {});
console.log("p1: ", p1);

// p2 执行 resolve
const p2 = new Promise((resolve, reject) => {
  resolve("success");
});
console.log("p2: ", p2);

// p3 执行 reject
const p3 = new Promise((resolve, reject) => {
  reject("fail");
});
console.log("p3: ", p3);

// p4 抛出错误
const p4 = new Promise((resolve, reject) => {
  throw Error("error");
});
console.log("p4: ", p4);

// p5 先执行 resolve 后执行 reject
const p5 = new Promise((resolve, reject) => {
  resolve("success");
  reject("fail");
});
console.log("p5: ", p5);

// p6 什么都不执行且不传参
const p6 = new Promise();
console.log("p6: ", p6);
```

我们来看一下输出结果:

![promise-case](https://files.mdnice.com/user/24727/52fa8fe1-6b3a-4fae-932c-53ee1568e070.png)

从输出结果我们可以发现:

- 创建 `promise` 对象时，需传入一个函数(否则会报错，详见 p6)，并且该函数会立即执行
- `promise` 的初始状态为 `Pending`(见 p1)
- 执行 `resolve()` 和 `reject()` 可以将 `promise` 的状态修改为 `Fulfilled` 和 `Rejected` (见 p2,p3)
- 若 `promise` 中抛出异常，相当于执行 `reject` (见 p4)
- `promise` 状态转变只能由 `Pending` 开始(见 p5)

根据我们对输出结果的分析，我们来编写 `promise` 的第一版代码。

## 实现基础 promise —— 第一版

### promise 构造函数实现

1. 首先定义 `promise` 的三种状态

```js
const PENDING = "PENDING";
const FULFILLED = "FULFILLED";
const REJECTED = "REJECTED";
```

2. 定义 `Promise` 构造函数，添加必备属性

`Promises/A+` 规范中指出:

- `value` 是任意的 `JavaScript` 合法值(包括 `undefined`)
- `reason` 是用来表示 `promise` 为什么被拒绝的原因

我们使用 `ES6 class` 定义 `Promise` 类，`value/reason` 分别赋值为 `undefined` ，状态 `status` 初始为 `PENDING`

```js
class Promise {
  constructor() {
    this.value = undefined;
    this.reason = undefined;
    this.status = PENDING;
  }
}
```

3. 定义 `promise` 时需要传入函数 `executor`

- `executor` 有两个参数，分别为 `resolve，reject`，且两个参数都是函数
- `executor` 会立即执行

```js
class Promise {
  constructor(executor) {
    this.value = undefined;
    this.reason = undefined;
    this.status = PENDING;
    // 定义resolve 和 reject 函数
    const resolve = () => {};
    const reject = () => {};
    // 构造器立即执行
    executor(resolve, reject);
  }
}
```

4. 实现 `resolve` 和 `reject` 的功能

当 `promise` 状态为 `Pedding` 时: `resolve` 函数可以将 `promise` 由 `Pending` 转变为 `Fulfilled`，并且更新 `promise` 的 `value` 值。`reject` 函数可以将 `promise` 由 `Pending` 转变为 `Rejected`，并且更新 `promise` 的 `reason` 值

> 注意: **`promise` 状态只能由 `Pending -> Fulfilled` 和 `Pending -> Rejected`**

因此在定义 `resolve` 和 `reject` 函数时，内部需要先判断 `promise` 的状态，如果状态为 `pending` ，才可以更新 `value` 值和 `promise` 状态。

```js
class Promise {
  constructor(executor) {
    this.value = undefined;
    this.reason = undefined;
    this.status = PENDING;

    const resolve = (value) => {
      // 判断当前的状态是否为Pending
      // promise状态转变只能从 Pending 开始
      if (this.status === PENDING) {
        // 更新 value 值和 promise 状态
        this.value = value;
        this.status = FULFILLED;
      }
    };
    const reject = (reason) => {
      if (this.status === PENDING) {
        this.reason = reason;
        this.status = REJECTED;
      }
    };

    executor(resolve, reject);
  }
}
```

源码写到这里，小包就产生疑惑了本文第一个疑问，来，上问题。

#### 提问一: resolve/reject 函数为什么使用箭头函数定义？

问题答案小包这里先不讲，大家先思考思考，到文末小包一块回答。

5. `Promise A+` 规范规定，`Promise` 执行抛出异常时，执行失败函数。因此我们需要捕获 `executor` 的执行，如果存在异常，执行 `reject` 函数。

```js

class Promise {
    // ...多余代码先暂省略
    // 捕获 executor 异常
    try {
      executor(resolve, reject);
    } catch (e) {
      // 当发生异常时，调用 reject 函数
      reject(e);
    }
  }
}
```

我们实现完了 `Promise` 的主体部分，下面就来实现 `Promise` 的另一重要核心 `then` 方法。

### 实现 then 方法的基本功能

`then` 方法的注意事项比较多，咱们一起来阅读规范顺带举例说明一下。

1. `promise.then` 接受两个参数:

```js
promise.then(onFulfilled, onRejected);
```

定义 `then` 函数，接收两个参数

```js
class Promise {
  then (onFulfilled, onRejected) {}
}
```

2. `onFulfilled` 和 `onRejected` 是可选参数，两者如果不是函数，则会**忽略**掉(真的是简单的忽略掉吗？请看下文**值穿透**)
3. 如果 `onFulfilled` 是一个函数，当 `promise` 状态为 `Fulfilled` 时，调用 `onFulfilled` 函数，`onRejected` 类似，当 `promise` 状态为 `Rejeted` 时调用。

我们继续来看几个栗子:

```js
// 执行 resolve
const p1 = new Promise((resolve, reject) => {
  resolve(1);
});
p1.then(
  (v) => {
    console.log("onFulfilled: ", v);
  },
  (r) => {
    console.log("onRejected: ", r);
  }
);

// 执行 reject
const p2 = new Promise((resolve, reject) => {
  reject(2);
});
p2.then(
  (v) => {
    console.log("onFulfilled: ", v);
  },
  (r) => {
    console.log("onRejected: ", r);
  }
);

// 抛出异常
const p3 = new Promise((resolve, reject) => {
  throw new Error("promise执行出现错误");
});
p3.then(
  (v) => {
    console.log("onFulfilled: ", v);
  },
  (r) => {
    console.log("onRejected: ", r);
  }
);
```

我们来看一下输出结果:

![promise-then](https://files.mdnice.com/user/24727/9923a89b-d31b-4056-983e-9308ee9b843b.png)

通过输出结果，我们可以发现 `then` 的调用逻辑

- 执行 `resolve` 后，`promise` 状态改变为 `Fulfilled`，`onFulfilled` 函数调用，参数值为 `value`。
- 执行 `reject` 或 抛出错误，`promise` 状态改变为 `Rejected` ，`onRejected` 函数调用，参数值为 `reason`。

接下来，我们来分析一下 `then` 的实现思路。

`then` 函数中判断 `promise` 当前的状态，如果为 `Fulfilled` 状态，执行 `onFulfilled` 函数；`Rejected` 状态，执行 `onRejected` 函数。实现思路很简单，那下面咱们就来实现一下。

```js
class Promise {
  then(onFulfilled, onRejected) {
    // 当状态为 Fulfilled 时，调用 onFulfilled函数
    if (this.status === FULFILLED) {
      onFulfilled(this.value);
    }
    // 当状态为 Rejected 时，调用 onRejected 函数
    if (this.status === REJECTED) {
      onRejected(this.reason);
    }
  }
}
```

#### 提问二: then 方法执行时 promise 状态会出现 Pending 状态吗

### promise 注册多个 then 方法

我们继续往下读规范：

如果一个 `promise` 调用多次 `then`: 当 `promise` 状态为 `Fulfilled` 时，所有的 `onFulfilled` 函数按照注册顺序调用。当 `promise` 状态为 `Rejected` 时，所有的 `onRejected` 函数按照注册顺序调用。

这个规范讲的是什么意思那？小包来举个栗子:

```js
const p = new Promise((resolve, reject) => {
  resolve("success");
});

p.then((v) => {
  console.log(v);
});
p.then((v) => {
  console.log(`${v}--111`);
});
```

输出结果:

```js
success;
success---111;
```

通过上面的案例，该规范通俗来讲: **同一个 promise 可以注册多个 then 方法，当 promise 完成或者失败后，对应的 then 方法按照注册顺序依次执行**。

该规范咱们的代码已经可以兼容。学到这里，我们整合一下 `Promise` 第一版代码，并对目前所写代码进行测试。

```js
// promise 三种状态
// 状态只能由 PENDING -> FULFILLED/REJECTED
const PENDING = "PENDING";
const FULFILLED = "FULFILLED";
const REJECTED = "REJECTED";

class Promise {
  constructor(executor) {
    this.value = undefined;
    this.reason = undefined;
    // 初始状态为 Pending
    this.status = PENDING;
    // this指向问题
    const resolve = (value) => {
      // 判断当前的状态是否为Pending
      // promise状态转变只能从 Pending 开始
      if (this.status === PENDING) {
        // 更新 value 值和 promise 状态
        this.value = value;
        this.status = FULFILLED;
      }
    };
    const reject = (reason) => {
      if (this.status === PENDING) {
        this.reason = reason;
        this.status = REJECTED;
      }
    };
    try {
      // 捕获 executor 异常
      executor(resolve, reject);
    } catch (e) {
      // 当发生异常时，调用 reject 函数
      reject(e);
    }
  }
  then(onFulfilled, onRejected) {
    // 当状态为 Fulfilled 时，调用 onFulfilled函数
    if (this.status === FULFILLED) {
      onFulfilled(this.value);
    }
    // 当状态为 Rejected 时，调用 onRejected 函数
    if (this.status === REJECTED) {
      onRejected(this.reason);
    }
  }
}
```

先来测试基础部分的案例，输出结果如下:

![promise-then](https://files.mdnice.com/user/24727/dc19792f-d8dd-4f49-8b7e-22d9d75a4921.png)

再来测试同一 `Promise` 注册多个 `then` 方法，输出结果为

```js
success;
success---111;
```

第一版代码是可以满足当前规范的，~~~，放松一下，我们来继续实现。

## 处理异步功能——第二版

文章刚开始我们就讲过，`promise` 是异步编程的一种解决方案，那我们来测试一下第一版 `Promise` 是否可以实现异步。

```js
const p = new Promise((resolve, reject) => {
  // 使用 setTimeout 模拟一下异步
  setTimeout(() => {
    resolve("success");
  });
});

p.then((v) => {
  console.log(v);
});
p.then((v) => {
  console.log(`${v}--111`);
});
```

没有任何输出，可见第一版代码到目前是无法实现异步编程的，我们来分析一下原因。

如果 `Promise` 内部存在异步调用，当执行到 `then` 函数时，此时由于 `resolve/reject` 处于异步回调之中，被阻塞未能调用，因此 `promise` 的状态仍为 `Pending`，第一版 `then` 回调中的 `onFulfilled` 和 `onRejected` 无法执行。

### 发布订阅模式

为了更好的实现原生 `promise` 的编写，在这里我们插补一点知识。

异步编程中有一个经常使用的思想，叫做发布订阅模式。发布订阅模式是指基于一个事件（主题）通道，希望接收通知的对象 `Subscriber` 通过自定义事件订阅主题，被激活事件的对象 `Publisher` 通过发布主题事件的方式通知各个订阅该主题的 `Subscriber` 对象。

发布订阅模式中有三个角色，发布者 `Publisher` ，事件通道 `Event Channel` ，订阅者 `Subscriber` 。

光凭借定义有点难以理解，小包举一个栗子: 以目前的**热播剧人世间**为例，人世间实在太火了，工作时候也安不下心，每天就迫不及待的等人世间更新，想在人世间更新的第一刻就开始看剧，那你应该怎么做呐？总不能时时刻刻刷新页面，监测人世间是否更新。平台是人性化的，其提供了消息订阅功能，如果你选择订阅，平台更新人世间后，会第一时间发消息通知你，订阅后，你就可以愉快的追剧了。

上面栗子中，追剧的我们就是订阅者 `Subscriber` ，人世间电视剧就是发布者 `Publisher` ，平台则就是事件通道，当人世间发布后，平台会通知所有订阅者。

更详细的讲解可以参考小包的博文: [观察者模式 vs 发布订阅模式，千万不要再混淆了](https://juejin.cn/post/7055441354054172709)

那我们要怎么设计 `Promise` 的异步功能呐? 我们把 `Promise` 的功能按照发布订阅模式分解一下:

- `then` 回调 `onFulfilled/onRejected` 函数
- `resolve/reject` 函数
- `resolve/reject` 函数执行后，`promise` 状态改变，`then` 回调函数执行

只有当 `resolve/reject` 函数执行后，对应 `onFulfilled/onRejected` 才可以执行执行，但由于存在异步调用，`resolve/reject` 执行晚于 `then` 函数。因此 `onFulfilled/onRejected` 就可以理解为订阅者，订阅 `resolve/reject` 函数执行；`resolve/reject` 是发布者；`Promise` 提供事件通道作用，存储订阅的 `onFulfilled/onRejected` 。**由于同一个 promise 对象可以注册多个 then 回调，因此 Event Channel 存储回调应为数组格式**

因此我们需要修改 `resolve/reject` 函数的实现，当两者被调用时，同时通知对应订阅者执行。

### 异步实现

1. 在 `Promise` 中定义两个数组 `onFulfilledCallbacks` 和 `onRejectedCallbacks` ，分别用来存储 `then` 回调 `onFulfilled` 和 `onRejected` 函数

```js
class Promise {
  // 存储订阅的onFulfilled函数和onRejected函数
  this.onFulfilledCallbacks = [];
  this.onRejectedCallbacks = [];
}
```

2. `then` 方法执行时，若 `Promise` 处于 `Pending` 状态，将 `onFulfilled` 和 `onRejected` 函数分别订阅至 `onFulfilledCallbacks` 和 `onRejectedCallbacks`——等待 `resolve/reject` 执行(事件发布)

```js
then(onFulfilled, onRejected) {
    if (this.status === PENDING) {
        // 当promise处于pending状态时，回调函数订阅
        this.onFulfilledCallbacks.push(onFulfilled);
        this.onRejectedCallbacks.push(onRejected);
    }
}
```

3. 调用 `resolve/reject` 时，发布事件，分别执行对应 `onFulfilledCallbacks` 和 `onRejectedCallbacks` 数组中的函数

```js
// 执行发布
const resolve = (value) => {
  if (this.status === PENDING) {
    this.value = value;
    this.status = FULFILLED;
    // 依次执行onFulfilled函数
    this.onFulfilledCallbacks.forEach((cb) => cb(this.value));
  }
};
const reject = (reason) => {
  if (this.status === PENDING) {
    this.reason = reason;
    this.status = REJECTED;
    // 依次执行onRejected函数
    this.onRejectedCallbacks.forEach((cb) => cb(this.reason));
  }
};
```

我们将上述代码进行汇总，形成第二版代码，并进行案例测试。

```js
// 异步调用
const PENDING = "PENDING";
const FULFILLED = "FULFILLED";
const REJECTED = "REJECTED";

class Promise {
  constructor(executor) {
    this.value = undefined;
    this.reason = undefined;
    this.status = PENDING;
    // 存储订阅的onFulfilled函数和onRejected函数
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];
    const resolve = (value) => {
      if (this.status === PENDING) {
        this.value = value;
        this.status = FULFILLED;
        // 当 resolve 函数调用时，通知订阅者 onFulfilled 执行
        this.onFulfilledCallbacks.forEach((cb) => cb(this.value));
      }
    };
    const reject = (reason) => {
      if (this.status === PENDING) {
        this.reason = reason;
        this.status = REJECTED;
        // 当 reject 函数调用时，通知订阅者 onRejected 执行
        this.onRejectedCallbacks.forEach((cb) => cb(this.reason));
      }
    };
    try {
      executor(resolve, reject);
    } catch (e) {
      console.log(e);
      reject(e);
    }
  }
  then(onFulfilled, onRejected) {
    if (this.status === FULFILLED) {
      onFulfilled(this.value);
    }
    if (this.status === REJECTED) {
      onRejected(this.reason);
    }
    if (this.status === PENDING) {
      // 当promise处于pending状态时，回调函数订阅
      this.onFulfilledCallbacks.push(onFulfilled);
      this.onRejectedCallbacks.push(onRejected);
    }
  }
}
```

使用刚才的案例进行测试，输出结果为

```js
success
success--111
```

上面的案例有些简单，我们再来测试一个复杂的案例:

```js
console.log(1);
setTimeout(() => {
  console.log(2);
})
const p1 = new Promise((resolve) => {
  console.log(3);
  setTimeout(() => {
    resolve(4);
  })
})
p1.then(v => console.log(v));
console.log(5);
```

浏览器输出结果:

![browser-promise](https://files.mdnice.com/user/24727/892ee826-2c15-4eb8-b70a-b4b582733268.png)

第二版代码输出结果:
![my-promise-async](https://files.mdnice.com/user/24727/b675fdf5-856c-4840-8b77-bce1b12e53b8.png)

浏览器与第二版输出的结果是相同的，因此可见目前第二版 `Promise` 是可以实现异步功能的。

但真的没问题吗？我们把案例稍微修改，去掉 `Promise` 中的异步调用，看浏览器输出结果是否与第二版相同。

```js
console.log(1);
setTimeout(() => {
  console.log(2);
})
const p1 = new Promise((resolve) => {
  console.log(3);
  resolve(4);
})
p1.then(v => console.log(v));
console.log(5);
```

浏览器输出结果:
![browser-promise2](https://files.mdnice.com/user/24727/678c32b9-894f-4c44-8cc7-6de51b369fa2.png)

第二版代码输出结果:
![my-promise-async](https://files.mdnice.com/user/24727/c71840ca-3aa1-4b0a-8583-8484ef6c54da.png)

我们可以明显的发现第二版代码与浏览器的**2 4** 输出是相反的？可见浏览器中先执行 `then` 方法，后执行 `setTimeout`?

#### 提问三: 为什么浏览器会先执行 then 方法回调，后执行 setTimeout 那？

## 链式调用——第三版

异步功能实现完毕，我们继续去实现 `then` 方法的链式调用。首先我们继续去读规范:

1. `then` 方法必须返回一个 `promise`

```js
promise2 = promise1.then(onFulfilled, onRejected)
```

`promise2` 是 `then` 函数的返回值，同样是一个 `Promise` 对象。

```js
then(onFulfilled, onRejected) {
  // ... 多余代码省略
  cosnt promise2 = new Promise((resolve, reject) => {})
  return promise2;
}
```

2. 如果 `onFulfilled` 或 `onRejected` 返回值为 `x` ，则运行 `Promise Resolution Procedure [[Resolve]](promise2, x)`(这里暂且将他理解为执行 promise2 的 resolve(x)函数)

我们来举栗子理解一下此条规范:

```js
// 案例1 resolve
console.log(new Promise((resolve) => {
    resolve(1)
}).then((x) => x))
// 案例2 reject
console.log(new Promise((resolve, reject) => {
    reject(1)
}).then(undefined,(r) => r))
```

![promise-then-chain](https://files.mdnice.com/user/24727/232fc653-be34-43fb-b63c-193e46671ccc.png)

**咦，怎么两者返回结果一样，明明 `promise` 中分别执行 `resolve` 和 `reject` 函数**。

我们再来详读一遍规范:

- 如果 `onFulfilled` 或 `onRejected` 返回值为 `x` ——上面两个函数都 `(v) => v`，传入参数值都是 `1`，因此返回值 `x = 1`；
- 则执行 `promise2` 的 `resolve(x)`函数，然后 `then` 返回 `promise2` 对象——因此上面两个函数都是调用 `promise2` 的 `resolve` 函数，所以两者返回值都是处于 `fulfilled` 状态的 `promise` 对象，并且值都为 `1`。

由于我们需要将 `onFulfilled/onRejected` 函数返回值作为 `promise2 resolve` 的参数值，因此我们需要将 `then` 函数整体移动至 `promise2` 内部。

```js
then (onFulfilled, onRejected) {
  let promise2 = new Promise((resolve, reject) => {
      if (this.status === FULFILLED) {
        // 返回值作为 resolve 的参数值
        let x = onFulfilled(this.value);
        resolve(x);
      }
      if (this.status === REJECTED) {
        let x = onRejected(this.reason);
        resolve(x);
      }
    });
    return promise2;
}
```

你以为这样就能实现这条规范了吗？NONONO!!!

**难点**: 同步代码上述思路的确可以实现，但设想这样一个场景，若 `Promise` 中存在异步代码，异步逻辑设计是 `then` 执行时，若 `Promise` 处于 `Pending` 状态，先将 `onFulfilled/onRejected` 函数订阅到 `onFulfilledCallbacks/onRejectedCallbacks` 中，意味着在 `then` 中此时两函数不会执行，那么此我们应该如何获取两者的返回值那?

因此我们不能单纯的使用 `this.onFulfilledCallbacks.push(onFulfilled)` 将回调函数压入事件通道的存储数组中，我们对回调函数做一层封装，将 `promise2` 的 `resolve` 函数和 `onFulfilled` 封装在一起，这样当 `onFulfilled` 执行时，可以获取其返回值 `x` ，返回 `fulfilled` 状态的 `promise2`，具体可以看下面代码:

```js
// 使用匿名箭头函数，保证内部 this 指向
() => {
  // 回调函数执行，获取其返回值
  let x = onFulfilled(this.value);
  // 执行 promise2 的 resolve 方法
  resolve(x);
}
```

因此 `Pending` 状态的代码如下:

```js
if (this.status === PENDING) {
  // 使用匿名函数，将 resovle 与 onFulfilled 捆绑在一起
  this.onFulfilledCallbacks.push(() => {
    let x = onFulfilled(this.value);
    resolve(x);
  });
  this.onRejectedCallbacks.push(() => {
    let x = onRejected(this.reason);
    resolve(x);
  });
}
```

3. 如果 `onFulfilled` 或 `onRejected` 执行过程中抛出异常 `e` ，则调用 `promise2` 的 `reject(e)`，返回 `promise2`

我们还是举栗子测试一下:

```js
console.log(new Promise((resolve) => {
    resolve(1)
}).then(()=> {
    throw new Error('resolve err')
}))
console.log(new Promise((resolve, reject) => {
    reject(1)
}).then(undefined,()=> {
    throw new Error('reject err')
}))
```

![promise-then-chain-reject](https://files.mdnice.com/user/24727/a1ca6c68-4030-41db-a316-c7aa9d607477.png)


通过输出结果，我们可以看出当 `onFulfilled/onRejected` 函数报错时，`promise2` 会执行其 `reject` 函数。因此我们需要给目前的代码添加一层异常捕获，将代码修改成如下情况:

```js
then(onFulfilled, onRejected) {
  let p1 = new Promise((resolve, reject) => {
    if (this.status === FULFILLED) {
      // 添加异常捕获
      try {
        // 返回值作为 resolve 的参数值
        let x = onFulfilled(this.value);
        resolve(x);
      } catch (e) {
        reject(e);
      }
    }
    //... 其余部分类似
  return promise2;
}
```

4. 如果 `onFulfilled` 不是函数，且 `promise` 状态为 `Fulfilled` ，那么 `promise2` 应该接受同样的值，同时状态为 `Fulfilled`

这个规范是啥意思呐？我们来举一个栗子:

```js
// 输出结果 1
const p1 = new Promise((resolve) => {
    resolve(1)
})
p1.then(x => x).then().then().then().then().then(x=> console.log(x))
```

上述程序最终输出结果为 `1` ，初次 `resolve` 传递的 `value` 值为 `1`，可见当 `onFulfilled` 不是函数时， `promise` 值会沿 `then` 发生传递，直到 `onFulfilled` 为函数。

这也就是 `Promise` 的值传递，当 `then` 的 `onFulfilled` 为非函数时，值会一直传递下去，直至遇到函数 `onFulfilled`

5. 如果 `onRejected` 不是函数，且 `promise` 状态为`Rejected`，那么 `promise2` 应该接受同样的原因，同时状态为 `Rejected`

```js
// 输出结果 Error: error at <anonymous>:4:33
const p1 = new Promise((resolve) => {
    reject(1)
})
p1.then(undefined, () => {throw Error('error')}).then().then().then().then().then(x=> console.log(x), (r)=> console.log(r))
```

与 `onFulfilled` 类似，`Promise` 同样提供了对`onRejected` 函数的兼容，会发生错误传递。

通过第 4 条与第 5 条的案例，我们可以发现，当 `onFulfilled/onRejected` 为非函数类型，`Promise` 会分别发生值传递和异常传递。

我们如何才能连续传递值或者异常那？(见下面代码)

- 值传递: 值传递非常简单，我们只需要定义一个函数，参数值为 x ，返回值为 x
- 异常: 定义函数参数值为异常，之后不断抛出此异常。

```js
x => x;
e => throw e;
```

```js
then(onFulfilled, onRejected) {
  // 判断参数是否为函数，如果不是函数，使用默认函数替代
  onFulfilled = typeof onFulfilled === "function" ? onFulfilled : (v) => v;
  onRejected =
    typeof onRejected === "function"
      ? onRejected
      : (e) => {
          throw e;
        };
  let promise2 = new Promise((resolve, reject) => {
  });
  return promise2;
}
}
```

写到这里，链式调用的部分就暂时实现了，我们整合一下第三版 `Promise` 代码。

```js
const PENDING = "PENDING";
const FULFILLED = "FULFILLED";
const REJECTED = "REJECTED";

class Promise {
  constructor(executor) {
    this.value = undefined;
    this.reason = undefined;
    this.status = PENDING;
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];
    const resolve = (value) => {
      if (this.status === PENDING) {
        this.value = value;
        this.status = FULFILLED;
        this.onFulfilledCallbacks.forEach((cb) => cb(this.value));
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
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }
  then(onFulfilled, onRejected) {
    onFulfilled = typeof onFulfilled === "function" ? onFulfilled : (v) => v;
    onRejected =
      typeof onRejected === "function"
        ? onRejected
        : (e) => {
            throw e;
          };
    let promise2 = new Promise((resolve, reject) => {
      if (this.status === FULFILLED) {
        // 添加异常捕获
        try {
          // 返回值作为 resolve 的参数值
          let x = onFulfilled(this.value);
          resolve(x);
        } catch (e) {
          reject(e);
        }
      }
      if (this.status === REJECTED) {
        try {
          let x = onRejected(this.reason);
          resolve(x);
        } catch (e) {
          reject(e);
        }
      }
      if (this.status === PENDING) {
        // 使用匿名函数，将 resovle 与 onFulfilled 捆绑在一起
        this.onFulfilledCallbacks.push(() => {
          try {
            let x = onFulfilled(this.value);
            resolve(x);
          } catch (e) {
            reject(e);
          }
        });
        this.onRejectedCallbacks.push(() => {
          try {
            let x = onRejected(this.reason);
            resolve(x);
          } catch (e) {
            reject(e);
          }
        });
      }
    });
    return promise2;
  }
}
```

我们测试一下是否可以实现链式调用:

```js
// 输出结果为 4，可以说明resolve状态的链式调用是可行的，并且实现了值传递
const p1 = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve(1);
  });
});
p1.then((v) => v + 1)
  .then((v) => v * 2)
  .then()
  .then((v) => console.log(v));

// 输出 Error1，说明链式调用仍然是成功的。
const p2 = new Promise((resolve, reject) => {
  setTimeout(() => {
    reject(1);
  });
});
p2.then(
  () => {},
  (r) => new Error(r)
).then(
  (v) => console.log("v", v),
  (r) => console.log("r", r)
);
```

写到这里，第三版代码就实现成功了，后面还有最核心的 `resolvePromise` 部分，该部分比较复杂，因此小包决定专门开一篇文章详细讲述。

## 问题回答

### resolve/reject 函数为什么使用构造函数定义？

一句话解释: `this` 指向问题。

我们将其修改为普通函数形式:

```js
class Promise {
  constructor(executor) {
    this.value = undefined;
    this.reason = undefined;
    const resovle = function (value) {
      console.log(this);
      this.value = value;
    }
    const reject = (reason) => {
      console.log(this);
      this.reason = reason;
    }
    executor(resovle, reject)
  }
}

```

之后我们分别执行以下代码:

```js
var value = 1;
new Promise((resolve, reject) => {
  resolve(100)
})
```

![this-value](https://files.mdnice.com/user/24727/ca43fd6d-b542-4549-abcf-9d9a64313cd5.png)


从结果我们可以发现: `this` 的输出结果为 `undefined` 。因为 `resolve` 是一个普通函数，在 `Promise` 中调用为默认调用，`this` 非严格模式指向 `window` ，严格模式指向 `undefined`。 `ES6 class` 默认为严格模式，因此指向 `undefined`。所以使用普通函数，**我们获取不到 `Promise` 中的 `value` 属性**。

```js
// 输出结果 Promise {value: undefined, reason: 200}
var reason = 2;
new Promise((resolve, reject) => {
  reject(200)
})
```

`reject` 使用箭头函数，箭头函数自身没有 `this` ，因此会沿作用域链使用外层作用域的 `this`。**所以我们可以获取到 `reason` 属性**。

如果你想了解更多关于 this 的知识，可以参考我的博文 [《2w 字大章 38 道面试题》彻底理清 JS 中 this 指向问题](https://juejin.cn/post/7019470820057546766)

### then 方法执行时 promise 状态会出现 pending 状态吗

会出现，文章中已经提到了，当 Promise 中存在异步代码时，例如

```js
new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve(1)
  })
})
```

### 为什么浏览器会先执行 then 方法回调，后执行 setTimeout 那？

这是 `JavaScript` 的事件机制(Event Loop)导致的，`then` 回调为微任务，`setTimeout` 为宏任务，当同步代码执行完毕后，主程序会先去微任务队列寻找任务，微任务队列全部执行完毕，才会执行宏任务队列。

如果你想了解更多关于 Event Loop 的知识，可以参考小包的博文 [JavaScript 之彻底理解 EventLoop](https://juejin.cn/post/7020328988715270157)
