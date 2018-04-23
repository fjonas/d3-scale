export default function(x) { // 返回一个 永远返回这个数字的 方法
  return function() {
    return x;
  };
}
