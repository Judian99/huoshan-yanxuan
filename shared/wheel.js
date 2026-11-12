/* ============================================================
   火山严选 · SVG 随机转盘
   ============================================================ */

(function () {
  "use strict";

  var VS = window.VS;
  var NS = "http://www.w3.org/2000/svg";
  var SEGMENT_COLORS = [
    "#dcc29a",
    "#c9ae86",
    "#e7d4b2",
    "#bfa47b",
    "#d8c6a6",
    "#cbb28b",
    "#e3cfab",
    "#c2a97f"
  ];

  function svgEl(tag, attrs) {
    var node = document.createElementNS(NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        node.setAttribute(key, attrs[key]);
      });
    }
    return node;
  }

  function polar(cx, cy, r, deg) {
    var rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(cx, cy, r, startDeg, endDeg) {
    var start = polar(cx, cy, r, startDeg);
    var end = polar(cx, cy, r, endDeg);
    var large = endDeg - startDeg > 180 ? 1 : 0;
    return (
      "M " +
      cx +
      " " +
      cy +
      " L " +
      start.x.toFixed(2) +
      " " +
      start.y.toFixed(2) +
      " A " +
      r +
      " " +
      r +
      " 0 " +
      large +
      " 1 " +
      end.x.toFixed(2) +
      " " +
      end.y.toFixed(2) +
      " Z"
    );
  }

  function truncate(name) {
    var chars = Array.from(String(name));
    return chars.length > 6 ? chars.slice(0, 6).join("") + "…" : String(name);
  }

  VS.createWheel = function (container, options) {
    if (!container) return null;
    var opts = options || {};
    var items = (opts.items || []).slice(0, 8);
    var rotation = 0;
    var spinning = false;
    var hub;
    var spinGroup;
    var segmentsGroup;
    var labelsGroup;
    var live;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    container.innerHTML = "";
    container.classList.add("vs-wheel");
    container.setAttribute("role", "group");

    var svg = svgEl("svg", {
      class: "vs-wheel__svg",
      viewBox: "0 0 340 340",
      "aria-hidden": "true",
      focusable: "false"
    });

    var ring = svgEl("circle", {
      cx: "170",
      cy: "170",
      r: "159",
      fill: "none",
      stroke: "rgba(74,55,36,.38)",
      "stroke-width": "1.5",
      "stroke-dasharray": "5 5"
    });
    svg.appendChild(ring);

    spinGroup = svgEl("g", { class: "vs-wheel__spin" });
    segmentsGroup = svgEl("g", {});
    labelsGroup = svgEl("g", {});
    spinGroup.appendChild(segmentsGroup);
    spinGroup.appendChild(labelsGroup);
    svg.appendChild(spinGroup);

    var inner = svgEl("circle", {
      cx: "170",
      cy: "170",
      r: "66",
      fill: "#efe2c6",
      stroke: "rgba(74,55,36,.22)",
      "stroke-width": "1",
      "stroke-dasharray": "3 4"
    });
    svg.appendChild(inner);

    container.appendChild(svg);

    var pointer = document.createElement("div");
    pointer.className = "vs-wheel__pointer";
    pointer.setAttribute("aria-hidden", "true");
    pointer.innerHTML =
      '<svg viewBox="0 0 28 40" focusable="false">' +
      '<circle cx="14" cy="9" r="7" fill="#a9342a" stroke="#f6eedc" stroke-width="2"/>' +
      '<path d="M14 39 L5 18 H23 Z" fill="#a9342a" stroke="#f6eedc" stroke-width="1.4"/>' +
      "</svg>";
    container.appendChild(pointer);

    hub = document.createElement("button");
    hub.type = "button";
    hub.className = "vs-wheel__hub";
    hub.setAttribute("aria-label", "转一下，随机选一道菜");
    hub.innerHTML = "<span>转</span><small>一下</small>";
    container.appendChild(hub);

    live = document.createElement("p");
    live.className = "vs-sr-only";
    live.setAttribute("aria-live", "polite");
    container.appendChild(live);

    function draw() {
      while (segmentsGroup.firstChild) segmentsGroup.removeChild(segmentsGroup.firstChild);
      while (labelsGroup.firstChild) labelsGroup.removeChild(labelsGroup.firstChild);
      if (!items.length) {
        container.setAttribute("aria-label", "转盘暂无候选菜谱");
        return;
      }

      var n = items.length;
      var angle = 360 / n;
      var cx = 170;
      var cy = 170;
      var radius = 159;

      if (n === 1) {
        segmentsGroup.appendChild(
          svgEl("circle", {
            cx: cx,
            cy: cy,
            r: radius,
            fill: SEGMENT_COLORS[0],
            stroke: "rgba(74,55,36,.18)",
            "stroke-width": "1"
          })
        );
      }

      items.forEach(function (recipe, i) {
        var start = -90 - angle / 2 + i * angle;
        var end = start + angle;
        var path = svgEl("path", {
          d: arcPath(cx, cy, radius, start, end),
          fill: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
          stroke: "rgba(74,55,36,.18)",
          "stroke-width": "1"
        });
        if (n > 1) segmentsGroup.appendChild(path);

        var mid = start + angle / 2;
        var labelPoint = polar(cx, cy, 112, mid);
        var emojiPoint = polar(cx, cy, 137, mid);
        var rot = mid + 90;
        if (rot > 90 && rot <= 270) rot += 180;

        var text = svgEl("text", {
          x: labelPoint.x.toFixed(2),
          y: labelPoint.y.toFixed(2),
          transform:
            "rotate(" + rot.toFixed(2) + " " + labelPoint.x.toFixed(2) + " " + labelPoint.y.toFixed(2) + ")",
          "text-anchor": "middle",
          "font-family": "'Kaiti SC','STKaiti','KaiTi','楷体',serif",
          "font-size": n > 6 ? "11.5" : "12.5",
          "font-weight": "600",
          fill: "#2b2117"
        });
        var title = document.createElementNS(NS, "title");
        title.textContent = recipe.name;
        text.appendChild(title);
        text.appendChild(document.createTextNode(truncate(recipe.name)));
        labelsGroup.appendChild(text);

        var emoji = svgEl("text", {
          x: emojiPoint.x.toFixed(2),
          y: emojiPoint.y.toFixed(2),
          transform:
            "rotate(" +
            rot.toFixed(2) +
            " " +
            emojiPoint.x.toFixed(2) +
            " " +
            emojiPoint.y.toFixed(2) +
            ")",
          "text-anchor": "middle",
          "font-size": "13",
          opacity: "0.82"
        });
        emoji.textContent = recipe.emoji || "🍲";
        labelsGroup.appendChild(emoji);
      });

      container.setAttribute(
        "aria-label",
        "随机转盘，候选菜：" +
          items
            .map(function (item) {
              return item.name;
            })
            .join("、")
      );
    }

    draw();

    function finish(index) {
      spinning = false;
      container.classList.remove("is-spinning");
      hub.disabled = false;
      var recipe = items[index];
      if (recipe) {
        live.textContent = "转盘停在：" + recipe.name;
        if (typeof opts.onResult === "function") opts.onResult(recipe, index);
      }
    }

    function spin() {
      if (spinning || !items.length) return;
      spinning = true;
      container.classList.add("is-spinning");
      hub.disabled = true;

      var index = Math.floor(Math.random() * items.length);
      var segmentAngle = 360 / items.length;
      var targetMod = (360 - ((index * segmentAngle) % 360)) % 360;
      var currentMod = ((rotation % 360) + 360) % 360;
      var delta = (targetMod - currentMod + 360) % 360;
      rotation += 360 * 5 + delta;

      if (reduceMotion.matches) {
        spinGroup.style.transition = "none";
        spinGroup.style.transform = "rotate(" + rotation + "deg)";
        window.setTimeout(function () {
          finish(index);
        }, 40);
        return;
      }

      spinGroup.style.transition = "none";
      spinGroup.style.transform = "rotate(" + (rotation - 360 * 5 - delta) + "deg)";
      // 强制一次重排，让过渡从当前位置开始
      spinGroup.getBoundingClientRect();

      window.requestAnimationFrame(function () {
        spinGroup.style.transition = "transform 3.6s cubic-bezier(.15,.72,.18,1)";
        spinGroup.style.transform = "rotate(" + rotation + "deg)";
      });

      var done = false;
      var onEnd = function (event) {
        if (event && event.target !== spinGroup) return;
        if (done) return;
        done = true;
        spinGroup.removeEventListener("transitionend", onEnd);
        finish(index);
      };
      spinGroup.addEventListener("transitionend", onEnd);
      window.setTimeout(onEnd, 3900);
    }

    hub.addEventListener("click", spin);

    return {
      spin: spin,
      setItems: function (next) {
        if (spinning) return false;
        items = (next || []).slice(0, 8);
        rotation = 0;
        spinGroup.style.transition = "none";
        spinGroup.style.transform = "rotate(0deg)";
        draw();
        return true;
      },
      getItems: function () {
        return items.slice();
      },
      isSpinning: function () {
        return spinning;
      }
    };
  };
})();
