import {bisect} from "d3-array";
import {interpolate as interpolateValue, interpolateRound} from "d3-interpolate";
import {map, slice} from "./array";
import constant from "./constant";
import number from "./number";

var unit = [0, 1];

export function deinterpolateLinear(a, b) {
  return (b -= (a = +a)) // b = b - a, 不知道为什么要花里胡哨
      ? function(x) { return (x - a) / b; } // 当a, b不相等, 返回 x 在 a, b中的比例. 也就是 x - a / b - a
      : constant(b); // 当a, b相等 永远返回  0
}

function deinterpolateClamp(deinterpolate) {
  return function(a, b) {
    var d = deinterpolate(a = +a, b = +b);
    return function(x) { return x <= a ? 0 : x >= b ? 1 : d(x); };
  };
}

function reinterpolateClamp(reinterpolate) {
  return function(a, b) {
    var r = reinterpolate(a = +a, b = +b);
    return function(t) { return t <= 0 ? a : t >= 1 ? b : r(t); };
  };
}

function bimap(domain, range, deinterpolate, reinterpolate) {
  var d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
  if (d1 < d0) d0 = deinterpolate(d1, d0), r0 = reinterpolate(r1, r0);
  else d0 = deinterpolate(d0, d1), r0 = reinterpolate(r0, r1);
  return function(x) { return r0(d0(x)); };
}

function polymap(domain, range, deinterpolate, reinterpolate) {
  var j = Math.min(domain.length, range.length) - 1,
      d = new Array(j),
      r = new Array(j),
      i = -1;

  // Reverse descending domains.
  if (domain[j] < domain[0]) {
    domain = domain.slice().reverse();
    range = range.slice().reverse();
  }

  while (++i < j) {
    d[i] = deinterpolate(domain[i], domain[i + 1]);
    r[i] = reinterpolate(range[i], range[i + 1]);
  }

  return function(x) {
    var i = bisect(domain, x, 1, j) - 1;
    return r[i](d[i](x));
  };
}

export function copy(source, target) {
  return target
      .domain(source.domain())
      .range(source.range())
      .interpolate(source.interpolate())
      .clamp(source.clamp());
}

// deinterpolate(a, b)(x) takes a domain value x in [a,b] and returns the corresponding parameter t in [0,1].
// reinterpolate(a, b)(t) takes a parameter t in [0,1] and returns the corresponding domain value x in [a,b].
export default function continuous(deinterpolate, reinterpolate) {
  var domain = unit,
      range = unit,
      interpolate = interpolateValue,
      clamp = false,
      piecewise,
      output,
      input;
  /*
    continuous返回值, 返回值调用任何方法的返回值都是这个.
    对piece wise做了处理, 把output和input置空,
    最后返回scale.
   */
  function rescale() {
    piecewise = Math.min(domain.length, range.length) > 2 ? polymap : bimap; // 我们使用的都是length === 2的, 所以是bimap
    output = input = null;
    return scale;
  }

  function scale(x) {
    return (output || (output = piecewise(domain, range, clamp ? deinterpolateClamp(deinterpolate) : deinterpolate, interpolate)))(+x);
    /*
        翻译:
        1. 输出: piecewise(domain, range, deinterpolate, interpolate)(x)
        2. clamp是通过scale.clamp()设置的, 超出范围是否纠正到范围内, 默认false, 如果是true会小小改写deinterpolate方法
        3. 在调用rescale()前都会保存当前输出(不重新计算, 因为结果肯定是一样的). rescale会在调用scale的任何方法时调用.
     */
  }

  scale.invert = function(y) {
    return (input || (input = piecewise(range, domain, deinterpolateLinear, clamp ? reinterpolateClamp(reinterpolate) : reinterpolate)))(+y);
    /*
        和上面scale一样, 调用了piecewise, 传了不同的参数~ 让我们到bimap里去研究吧.
     */
  };

  scale.domain = function(_) {
    return arguments.length ? (domain = map.call(_, number), rescale()) : domain.slice();
    /*
        如果不传参, 返回当前domain, 阻断链式操作
        如果传了, domain = _.map( a => +a), 然后返回rescale(), 也就是一顿操作再返回scale
     */
  };

  scale.range = function(_) {
    return arguments.length ? (range = slice.call(_), rescale()) : range.slice();
    /*
        和domain一样, 可能range不一定要是数字.
     */
  };

  scale.rangeRound = function(_) {
    return range = slice.call(_), interpolate = interpolateRound, rescale();
  };

  scale.clamp = function(_) { // 设置超出范围是否纠正到范围内
    return arguments.length ? (clamp = !!_, rescale()) : clamp;
  };

  scale.interpolate = function(_) { // 这个本来是从d3-interpolate引入的, 修改这个会改变算法
    return arguments.length ? (interpolate = _, rescale()) : interpolate;
  };

  return rescale();
}
