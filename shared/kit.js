/* ============================================================
   火山严选 · 共享交互组件
   日期条 / 月历 / 餐次弹选 / 选菜 / 菜谱详情与表单 / 复制 / 转盘结果
   ============================================================ */

(function () {
  "use strict";

  var VS = window.VS;
  var ui = (VS.ui = VS.ui || {});
  var uid = 0;

  /* ---------- 小工具 ---------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function append(parent, children) {
    (Array.isArray(children) ? children : [children]).forEach(function (child) {
      if (child) parent.appendChild(child);
    });
    return parent;
  }

  function tagNames(recipe) {
    return (recipe.tags || [])
      .map(function (id) {
        return VS.slotName(id);
      })
      .join(" / ");
  }

  function metaText(recipe) {
    var parts = [];
    if (recipe.tags && recipe.tags.length) parts.push(tagNames(recipe));
    if (recipe.minutes) parts.push(recipe.minutes + " 分钟");
    parts.push((recipe.ingredients || []).length + " 样食材");
    return parts.join(" · ");
  }

  function emptyState(text, hint) {
    var node = el("div", "vs-empty");
    node.appendChild(document.createTextNode(text));
    if (hint) {
      var small = el("small", null, hint);
      node.appendChild(small);
    }
    return node;
  }

  ui.el = el;
  ui.clear = clear;
  ui.emptyState = emptyState;
  ui.tagNames = tagNames;
  ui.metaText = metaText;

  /* ---------- 菜品插图 ---------- */

  ui.art = function (recipe, className) {
    var node = el(
      "div",
      "vs-art" +
        (recipe.image ? " vs-art--photo" : "") +
        (className ? " " + className : "")
    );
    node.style.setProperty("--tint", recipe.tint || "#e3cfa9");
    if (recipe.image) {
      var img = el("img");
      img.src = recipe.image;
      img.alt = "";
      node.appendChild(img);
    } else {
      var emoji = el("span", "vs-art__emoji", recipe.emoji || "🍲");
      emoji.setAttribute("aria-hidden", "true");
      node.appendChild(emoji);
    }
    return node;
  };

  /* ---------- 印章提示 ---------- */

  var toastNode = null;
  var toastTimer = null;

  function toast(message, options) {
    options = options || {};
    if (toastNode) {
      toastNode.remove();
      toastNode = null;
    }
    window.clearTimeout(toastTimer);

    var node = el("div", "vs-toast");
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");

    node.appendChild(el("span", "vs-toast__seal", "记"));
    node.appendChild(el("span", "vs-toast__msg", message));

    if (typeof options.undo === "function") {
      var undo = el("button", "vs-toast__undo", "撤销");
      undo.type = "button";
      undo.addEventListener("click", function () {
        options.undo();
        removeToast();
      });
      node.appendChild(undo);
    }

    document.body.appendChild(node);
    toastNode = node;
    toastTimer = window.setTimeout(removeToast, options.undo ? 5200 : 3600);
  }

  function removeToast() {
    if (!toastNode) return;
    var node = toastNode;
    toastNode = null;
    window.clearTimeout(toastTimer);
    node.style.opacity = "0";
    node.style.transition = "opacity .2s ease";
    window.setTimeout(function () {
      node.remove();
    }, 220);
  }

  ui.toast = toast;

  /* ---------- 底部弹层（支持叠层） ---------- */

  var sheetStack = [];

  function focusables(root) {
    return Array.prototype.slice
      .call(
        root.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )
      .filter(function (node) {
        return node.offsetParent !== null || node === document.activeElement;
      });
  }

  function activeSheet() {
    return sheetStack.length ? sheetStack[sheetStack.length - 1] : null;
  }

  function focusInto(state) {
    if (!state || activeSheet() !== state) return;
    var target = state.initialFocus ? state.sheet.querySelector(state.initialFocus) : null;
    if (!target || target.disabled) {
      var list = focusables(state.body);
      target = list.length ? list[0] : focusables(state.sheet)[0];
    }
    if (target) target.focus({ preventScroll: true });
    else state.sheet.focus({ preventScroll: true });
  }

  function closeSheet(immediate, skipFocus) {
    var state = activeSheet();
    if (!state) return;
    sheetStack.pop();
    document.removeEventListener("keydown", state.keyHandler, true);

    if (typeof state.onClose === "function") {
      try {
        state.onClose();
      } catch (err) {
        if (window.console) console.error(err);
      }
    }

    var previous = activeSheet();
    var cleanup = function () {
      state.scrim.remove();
      state.sheet.remove();
      if (!sheetStack.length) {
        document.documentElement.classList.remove("vs-lock");
        if (!skipFocus && !previous && state.opener && state.opener.isConnected) {
          state.opener.focus({ preventScroll: true });
        }
      }
    };

    if (previous) {
      previous.sheet.removeAttribute("aria-hidden");
      var opener = state.opener;
      window.setTimeout(function () {
        if (activeSheet() !== previous) return;
        if (opener && opener.isConnected && previous.sheet.contains(opener)) {
          opener.focus({ preventScroll: true });
        } else {
          previous.sheet.focus({ preventScroll: true });
        }
      }, 340);
    }

    if (immediate) {
      cleanup();
      return;
    }

    state.scrim.classList.remove("is-open");
    state.sheet.classList.remove("is-open");
    window.setTimeout(cleanup, 330);
  }

  function openSheet(options) {
    options = options || {};
    var previous = activeSheet();
    var depth = sheetStack.length;

    var id = "vs-sheet-" + ++uid;
    var scrim = el("div", "vs-scrim");
    var sheet = el(
      "section",
      "vs-sheet" +
        (options.variant === "full" ? " vs-sheet--full" : "") +
        (options.bare ? " vs-sheet--bare" : "") +
        (options.className ? " " + options.className : "")
    );
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.tabIndex = -1;
    scrim.style.zIndex = String(120 + depth * 10);
    sheet.style.zIndex = String(121 + depth * 10);

    if (options.title) {
      sheet.setAttribute("aria-labelledby", id + "-title");
    } else {
      sheet.setAttribute("aria-label", options.label || "对话框");
    }

    var sub = null;

    if (!options.bare) {
      sheet.appendChild(el("div", "vs-sheet__grip"));

      var head = el("header", "vs-sheet__head");
      if (options.title) {
        var title = el("h2", "vs-sheet__title", options.title);
        title.id = id + "-title";
        head.appendChild(title);
      }
      sub = el("p", "vs-sheet__sub", options.subtitle || "");
      if (!options.subtitle) sub.style.display = "none";
      head.appendChild(sub);

      var closeBtn = el("button", "vs-sheet__close", "×");
      closeBtn.type = "button";
      closeBtn.setAttribute("aria-label", "关闭");
      closeBtn.addEventListener("click", function () {
        closeSheet();
      });
      head.appendChild(closeBtn);
      sheet.appendChild(head);
    }

    var body = el("div", "vs-sheet__body");
    if (options.content) body.appendChild(options.content);
    sheet.appendChild(body);

    var foot = null;
    if (options.footer) {
      foot = el("div", "vs-sheet__foot");
      append(foot, options.footer);
      sheet.appendChild(foot);
    }

    var state = {
      scrim: scrim,
      sheet: sheet,
      body: body,
      footer: foot,
      opener: document.activeElement,
      keyHandler: null,
      onClose: options.onClose,
      initialFocus: options.initialFocus
    };

    var keyHandler = function (event) {
      if (activeSheet() !== state) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeSheet();
        return;
      }
      if (event.key !== "Tab") return;
      var list = focusables(sheet);
      if (!list.length) {
        event.preventDefault();
        sheet.focus();
        return;
      }
      var first = list[0];
      var last = list[list.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first || !sheet.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    state.keyHandler = keyHandler;

    if (options.dismissible !== false) {
      scrim.addEventListener("click", function () {
        if (activeSheet() !== state) return;
        closeSheet();
      });
    }

    if (previous) {
      previous.sheet.setAttribute("aria-hidden", "true");
    }

    document.body.appendChild(scrim);
    document.body.appendChild(sheet);
    document.documentElement.classList.add("vs-lock");
    document.addEventListener("keydown", keyHandler, true);
    sheetStack.push(state);

    window.setTimeout(function () {
      scrim.classList.add("is-open");
      sheet.classList.add("is-open");
    }, 24);

    window.setTimeout(function () {
      focusInto(state);
    }, 90);

    return {
      sheet: sheet,
      scrim: scrim,
      body: body,
      footer: foot,
      close: closeSheet,
      setSubtitle: function (text) {
        if (!sub) return;
        sub.textContent = text || "";
        sub.style.display = text ? "" : "none";
      }
    };
  }

  ui.openSheet = openSheet;
  ui.closeSheet = closeSheet;

  /* ---------- 日期条 ---------- */

  ui.dateStrip = function (container, options) {
    if (!container) return;
    options = options || {};
    var selected = options.selected || VS.todayKey();
    var days = options.days || 7;
    var todayKey = VS.todayKey();
    var diff = VS.dayDiff(selected, todayKey);
    var start;

    if (diff >= 0 && diff <= days - 1) {
      start = new Date();
    } else {
      start = VS.parseDate(selected);
    }

    clear(container);
    container.classList.add("vs-datestrip");

    for (var i = 0; i < days; i++) {
      (function (offset) {
        var date = VS.addDays(start, offset);
        var key = VS.dateKey(date);
        var count = VS.dayDishCount(key);
        var btn = el("button", "vs-datestrip__day");
        btn.type = "button";
        btn.dataset.date = key;

        if (key === selected) btn.classList.add("is-active");
        if (key === todayKey) btn.classList.add("is-today");

        btn.setAttribute("aria-pressed", key === selected ? "true" : "false");
        btn.setAttribute(
          "aria-label",
          VS.dayTitle(key) + (count ? "，已点 " + count + " 道菜" : "，还没有点菜")
        );

        var wd = el("span", "vs-datestrip__wd", key === todayKey ? "今天" : "周" + VS.weekdayCN(date));
        var num = el("span", "vs-datestrip__num", String(date.getDate()));
        btn.appendChild(wd);
        btn.appendChild(num);

        if (count > 0) {
          btn.appendChild(el("span", "vs-datestrip__dot"));
        }

        if (typeof options.onChange === "function") {
          btn.addEventListener("click", function () {
            options.onChange(key);
          });
        }

        container.appendChild(btn);
      })(i);
    }
  };

  /* ---------- 月历 ---------- */

  function addMonths(date, delta) {
    return new Date(date.getFullYear(), date.getMonth() + delta, 1);
  }

  ui.calendar = function (container, options) {
    if (!container) return;
    options = options || {};
    var selected = options.selected || VS.todayKey();
    var todayKey = VS.todayKey();
    var base = options.month
      ? new Date(options.month.getFullYear(), options.month.getMonth(), 1)
      : VS.parseDate(todayKey);
    base = new Date(base.getFullYear(), base.getMonth(), 1);

    clear(container);
    container.classList.add("vs-cal");

    var head = el("div", "vs-cal__head");
    var prev = el("button", "vs-cal__nav", "‹");
    prev.type = "button";
    prev.setAttribute("aria-label", "上个月");
    prev.addEventListener("click", function () {
      if (typeof options.onMonthChange === "function") options.onMonthChange(addMonths(base, -1));
    });

    var center = el("div", "vs-cal__center");
    center.appendChild(el("div", "vs-cal__title", base.getFullYear() + "年" + (base.getMonth() + 1) + "月"));
    var todayBtn = el("button", "vs-cal__today", "回到今天");
    todayBtn.type = "button";
    todayBtn.addEventListener("click", function () {
      if (typeof options.onToday === "function") options.onToday();
    });
    center.appendChild(todayBtn);

    var next = el("button", "vs-cal__nav", "›");
    next.type = "button";
    next.setAttribute("aria-label", "下个月");
    next.addEventListener("click", function () {
      if (typeof options.onMonthChange === "function") options.onMonthChange(addMonths(base, 1));
    });

    append(head, [prev, center, next]);
    container.appendChild(head);

    var grid = el("div", "vs-cal__grid");
    ["一", "二", "三", "四", "五", "六", "日"].forEach(function (wd) {
      grid.appendChild(el("div", "vs-cal__wd", wd));
    });

    var first = new Date(base.getFullYear(), base.getMonth(), 1);
    var leading = (first.getDay() + 6) % 7;
    var daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();

    for (var i = 0; i < 42; i++) {
      if (i < leading || i >= leading + daysInMonth) {
        grid.appendChild(el("div", "vs-cal__day is-other"));
        continue;
      }

      (function (day) {
        var date = new Date(base.getFullYear(), base.getMonth(), day);
        var key = VS.dateKey(date);
        var btn = el("button", "vs-cal__day");
        btn.type = "button";
        btn.dataset.date = key;
        if (key === todayKey) btn.classList.add("is-today");
        if (key === selected) btn.classList.add("is-selected");
        btn.setAttribute("aria-pressed", key === selected ? "true" : "false");
        btn.setAttribute(
          "aria-label",
          VS.dayTitle(key) + (VS.hasPlan(key) ? "，已点菜" : "，还没有点菜")
        );

        btn.appendChild(el("span", "vs-cal__num", String(day)));
        if (VS.hasPlan(key)) btn.appendChild(el("span", "vs-cal__dot"));

        btn.addEventListener("click", function () {
          if (typeof options.onSelect === "function") options.onSelect(key);
        });
        grid.appendChild(btn);
      })(i - leading + 1);
    }

    container.appendChild(grid);
  };

  /* ---------- 餐次选择 ---------- */

  ui.slotSheet = function (options) {
    options = options || {};
    var dateKey = options.dateKey || VS.todayKey();
    if (VS.isPast(dateKey)) {
      toast("过去的日子只能翻看。");
      return;
    }
    var today = VS.isToday(dateKey);
    var current = VS.currentSlot();
    var plan = VS.planFor(dateKey);
    var body = el("div", "vs-slots");

    VS.slots.forEach(function (slot) {
      var count = (plan[slot.id] || []).length;
      var btn = el("button", "vs-slotrow");
      btn.type = "button";
      if (options.preselect === slot.id) btn.classList.add("is-preselect");

      btn.appendChild(el("span", "vs-slotrow__glyph", slot.glyph));

      var main = el("span", "vs-slotrow__main");
      var name = el("span", "vs-slotrow__name");
      name.appendChild(document.createTextNode(slot.name));
      if (today && current === slot.id) {
        name.appendChild(el("span", "vs-slotrow__now", "现在"));
      }
      main.appendChild(name);
      main.appendChild(
        el(
          "span",
          "vs-slotrow__meta",
          (count ? "已有 " + count + " 道 · " : "还空着 · ") + VS.slotRangeText(slot)
        )
      );
      btn.appendChild(main);
      btn.appendChild(el("span", "vs-slotrow__arrow", "›"));

      btn.addEventListener("click", function () {
        closeSheet();
        if (typeof options.onPick === "function") options.onPick(slot.id);
      });
      body.appendChild(btn);
    });

    var subtitle = options.subtitle;
    if (!subtitle) {
      if (today) {
        subtitle = VS.dayTitle(dateKey) + " · 现在是" + VS.slotName(current) + "时段";
      } else {
        subtitle = VS.dayTitle(dateKey) + " · 提前备菜，请选择餐次";
      }
    }

    openSheet({
      title: options.title || "放进哪一餐？",
      subtitle: subtitle,
      content: body
    });
  };

  /* ---------- 选菜面板 ---------- */

  ui.recipePicker = function (options) {
    options = options || {};
    var dateKey = options.dateKey || VS.todayKey();
    var slotId = options.slotId;
    var slot = VS.slotMap[slotId];
    if (!slot) return;
    if (VS.isPast(dateKey)) {
      toast("过去的日子只能翻看。");
      return;
    }

    var initial = (VS.planFor(dateKey)[slotId] || []).slice();
    var mode = "slot";
    var query = "";
    var sheet;
    var countSpan;

    var body = el("div", "vs-picker");
    var tools = el("div", "vs-picker__tools");

    var segment = el("div", "vs-picker__segment");
    var recBtn = el("button", null, slot.name + "推荐");
    recBtn.type = "button";
    recBtn.setAttribute("aria-pressed", "true");
    var allBtn = el("button", null, "全部菜谱");
    allBtn.type = "button";
    allBtn.setAttribute("aria-pressed", "false");
    append(segment, [recBtn, allBtn]);
    tools.appendChild(segment);

    var searchWrap = el("div", "vs-field");
    var search = el("input", "vs-input");
    search.type = "search";
    search.placeholder = "找菜名，也可以搜食材";
    search.setAttribute("aria-label", "搜索菜谱");
    searchWrap.appendChild(search);
    tools.appendChild(searchWrap);

    body.appendChild(tools);

    var list = el("div", "vs-picklist");
    body.appendChild(list);

    var footer = el("button", "vs-btn vs-btn--seal", "好了");
    footer.type = "button";

    function currentIds() {
      return (VS.planFor(dateKey)[slotId] || []).slice();
    }

    function visibleRecipes() {
      var base = mode === "slot" ? VS.recipesFor(slotId) : VS.recipes.slice();
      if (mode !== "slot" && slotId) {
        // 全部菜谱模式下仍按搜索词过滤
      }
      var q = query.trim().toLowerCase();
      if (!q) return base;
      return base.filter(function (recipe) {
        if (recipe.name.toLowerCase().indexOf(q) !== -1) return true;
        return (recipe.ingredients || []).some(function (ing) {
          return ing.name.toLowerCase().indexOf(q) !== -1;
        });
      });
    }

    function renderList() {
      clear(list);
      var recipes = visibleRecipes();
      var ids = currentIds();

      if (!recipes.length) {
        if (mode === "slot" && !query) {
          var empty = emptyState(
            "这一餐还没有合适的菜。",
            "可以切到「全部菜谱」，或者先写一道新的。"
          );
          var seeAll = el("button", "vs-btn vs-btn--ghost vs-btn--sm", "看全部菜谱");
          seeAll.type = "button";
          seeAll.style.margin = "10px auto 0";
          seeAll.style.display = "flex";
          seeAll.addEventListener("click", function () {
            setMode("all");
          });
          empty.appendChild(seeAll);
          list.appendChild(empty);
        } else {
          list.appendChild(
            emptyState(query ? "没有找到这道菜。" : "菜谱本里还是空的。", "换个词，或者先写一道。")
          );
        }
        return;
      }

      recipes.forEach(function (recipe) {
        var on = ids.indexOf(recipe.id) !== -1;
        var row = el("button", "vs-pick" + (on ? " is-on" : ""));
        row.type = "button";
        row.setAttribute("aria-pressed", on ? "true" : "false");
        row.setAttribute("aria-label", recipe.name + (on ? "，已加入" : "，点一下加入"));

        var art = ui.art(recipe, "vs-pick__art");
        var main = el("span", "vs-pick__main");
        main.appendChild(el("span", "vs-pick__name", recipe.name));
        main.appendChild(el("span", "vs-pick__meta", metaText(recipe)));

        row.appendChild(art);
        row.appendChild(main);
        row.appendChild(el("span", "vs-pick__check", "✓"));

        row.addEventListener("click", function () {
          if (currentIds().indexOf(recipe.id) !== -1) {
            VS.removeDish(dateKey, slotId, recipe.id);
          } else {
            VS.addDish(dateKey, slotId, recipe.id);
          }
          renderList();
          updateFooter();
        });

        list.appendChild(row);
      });
    }

    function updateFooter() {
      var n = currentIds().length;
      footer.textContent = "好了（" + n + " 道）";
      if (countSpan) {
        countSpan.textContent = n ? "这一餐已有 " + n + " 道" : "这一餐还空着";
      }
    }

    function setMode(next) {
      mode = next;
      recBtn.setAttribute("aria-pressed", next === "slot" ? "true" : "false");
      allBtn.setAttribute("aria-pressed", next === "all" ? "true" : "false");
      renderList();
    }

    recBtn.addEventListener("click", function () {
      setMode("slot");
    });
    allBtn.addEventListener("click", function () {
      setMode("all");
    });
    search.addEventListener("input", function () {
      query = search.value;
      renderList();
    });

    footer.addEventListener("click", function () {
      closeSheet();
    });

    renderList();

    var subtitleNode = el("span", null, "");
    countSpan = subtitleNode;
    updateFooter();

    sheet = openSheet({
      title: "放进「" + slot.name + "」",
      subtitle:
        (VS.isFuture(dateKey) ? "提前备菜 · " : "") +
        VS.dayTitle(dateKey) +
        " · " +
        (currentIds().length ? "已有 " + currentIds().length + " 道，继续点" : "点一道就加进去"),
      content: body,
      footer: footer,
      onClose: function () {
        var finalIds = currentIds();
        var added = finalIds.filter(function (id) {
          return initial.indexOf(id) === -1;
        });
        var removed = initial.filter(function (id) {
          return finalIds.indexOf(id) === -1;
        });

        if (added.length || removed.length) {
          var dayLabel = VS.isToday(dateKey)
            ? "今天"
            : VS.relativeLabel(dateKey) || VS.shortDate(VS.parseDate(dateKey));
          var message = added.length
            ? dayLabel + " · " + slot.name + " · 加进 " + added.length + " 道"
            : dayLabel + " · " + slot.name + " · 移除 " + removed.length + " 道";
          toast(message, {
            undo: function () {
              VS.setSlot(dateKey, slotId, initial);
            }
          });
        }

        if (typeof options.onDone === "function") options.onDone();
      }
    });

    // 让副标题在勾选时保持最新
    var originalRender = renderList;
    renderList = function () {
      originalRender();
      if (sheet) {
        var n = currentIds().length;
        sheet.setSubtitle(
          (VS.isFuture(dateKey) ? "提前备菜 · " : "") +
            VS.dayTitle(dateKey) +
            " · " +
            (n ? "已选 " + n + " 道，继续点或点「好了」" : "点一道就加进去")
        );
      }
    };

    updateFooter();
    renderList();
  };

  /* ---------- 菜谱详情 ---------- */

  ui.recipeDetail = function (recipe, options) {
    options = options || {};
    var body = el("div");

    var hero = ui.art(recipe, "vs-detail__hero");
    body.appendChild(hero);

    var tags = el("div", "vs-detail__tags");
    (recipe.tags || []).forEach(function (id) {
      tags.appendChild(el("span", "vs-detail__tag", VS.slotName(id)));
    });
    if (recipe.minutes) tags.appendChild(el("span", "vs-detail__tag", recipe.minutes + " 分钟"));
    body.appendChild(tags);

    if (recipe.note) {
      body.appendChild(el("div", "vs-detail__note", recipe.note));
    }

    body.appendChild(el("div", "vs-detail__h", "食材"));
    var ingWrap = el("div");
    (recipe.ingredients || []).forEach(function (ing) {
      var row = el("div", "vs-ing");
      row.appendChild(el("span", "vs-ing__name", ing.name));
      row.appendChild(el("span", "vs-ing__dots"));
      row.appendChild(el("span", "vs-ing__amount", ing.amount));
      ingWrap.appendChild(row);
    });
    body.appendChild(ingWrap);

    body.appendChild(el("div", "vs-detail__h", "步骤"));
    var stepWrap = el("div");
    (recipe.steps || []).forEach(function (step, i) {
      var row = el("div", "vs-step");
      row.appendChild(el("span", "vs-step__num", String(i + 1)));
      row.appendChild(el("span", null, step));
      stepWrap.appendChild(row);
    });
    body.appendChild(stepWrap);

    var del = el("button", "vs-detail__danger", "删除这道菜");
    del.type = "button";
    del.addEventListener("click", function () {
      toast("演示版暂未接入删除。");
    });
    body.appendChild(del);

    var orderBtn = el("button", "vs-btn vs-btn--seal", "点这道菜");
    orderBtn.type = "button";
    orderBtn.addEventListener("click", function () {
      closeSheet();
      if (typeof options.onOrder === "function") options.onOrder(recipe);
    });

    var editBtn = el("button", "vs-btn vs-btn--ghost", "编辑");
    editBtn.type = "button";
    editBtn.addEventListener("click", function () {
      toast("演示版暂未接入编辑。");
    });

    openSheet({
      title: recipe.name,
      subtitle: metaText(recipe),
      content: body,
      footer: [orderBtn, editBtn],
      initialFocus: ".vs-sheet__foot .vs-btn--seal"
    });
  };

  /* ---------- 写菜谱 ---------- */

  ui.recipeForm = function (options) {
    options = options || {};
    var state = { image: null, tags: [] };
    var idBase = "vs-form-" + ++uid;

    var body = el("div", "vs-form");

    /* 菜名 */
    var nameField = el("div", "vs-field");
    var nameLabel = el("label", "vs-field__label", "菜名");
    nameLabel.setAttribute("for", idBase + "-name");
    var nameInput = el("input", "vs-input");
    nameInput.id = idBase + "-name";
    nameInput.type = "text";
    nameInput.placeholder = "比如：番茄炒蛋";
    nameInput.autocomplete = "off";
    var nameError = el("span", "vs-field__error");
    nameError.style.display = "none";
    nameError.id = idBase + "-name-error";
    nameInput.setAttribute("aria-describedby", nameError.id);
    append(nameField, [nameLabel, nameInput, nameError]);
    body.appendChild(nameField);

    /* 图片 */
    var photoField = el("div", "vs-field");
    photoField.appendChild(el("span", "vs-field__label", "照片"));
    var photo = el("label", "vs-photo");
    photo.setAttribute("for", idBase + "-photo");
    var prompt = el("span", "vs-photo__prompt");
    prompt.appendChild(el("span", "vs-photo__mark", "+"));
    prompt.appendChild(el("span", null, "加一张照片"));
    photo.appendChild(prompt);
    var fileInput = el("input", "vs-file-input");
    fileInput.id = idBase + "-photo";
    fileInput.type = "file";
    fileInput.accept = "image/*";
    photo.appendChild(fileInput);
    photoField.appendChild(photo);
    photoField.appendChild(el("span", "vs-field__hint", "照片只在这次预览里出现，刷新就没了。"));
    body.appendChild(photoField);

    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (file.size > 12 * 1024 * 1024) {
        toast("这张图有点大，换一张小一点的。");
        fileInput.value = "";
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        state.image = reader.result;
        clear(photo);
        var img = el("img");
        img.src = state.image;
        img.alt = "";
        photo.appendChild(img);
        photo.appendChild(el("span", "vs-photo__edit", "换一张"));
        photo.appendChild(fileInput);
      };
      reader.readAsDataURL(file);
    });

    /* 时段 */
    var tagField = el("div", "vs-field");
    tagField.appendChild(el("span", "vs-field__label", "适合哪几餐"));
    var tagRow = el("div", "vs-tagrow");
    VS.slots.forEach(function (slot) {
      var chip = el("button", "vs-chip", slot.name);
      chip.type = "button";
      chip.setAttribute("aria-pressed", "false");
      chip.addEventListener("click", function () {
        var idx = state.tags.indexOf(slot.id);
        if (idx === -1) state.tags.push(slot.id);
        else state.tags.splice(idx, 1);
        chip.setAttribute("aria-pressed", idx === -1 ? "true" : "false");
        tagError.style.display = "none";
      });
      tagRow.appendChild(chip);
    });
    tagField.appendChild(tagRow);
    var tagError = el("span", "vs-field__error");
    tagError.style.display = "none";
    tagField.appendChild(tagError);
    body.appendChild(tagField);

    /* 用时 */
    var timeField = el("div", "vs-field");
    var timeLabel = el("label", "vs-field__label", "大概要多久");
    timeLabel.setAttribute("for", idBase + "-minutes");
    var timeInput = el("input", "vs-input");
    timeInput.id = idBase + "-minutes";
    timeInput.type = "number";
    timeInput.min = "1";
    timeInput.inputMode = "numeric";
    timeInput.placeholder = "20";
    timeField.appendChild(timeLabel);
    var timeRow = el("div", "vs-row");
    timeRow.appendChild(timeInput);
    timeRow.appendChild(el("span", "vs-field__hint", "分钟"));
    timeField.appendChild(timeRow);
    body.appendChild(timeField);

    /* 食材 */
    var ingField = el("div", "vs-field");
    ingField.appendChild(el("span", "vs-field__label", "食材"));
    ingField.appendChild(el("span", "vs-field__hint", "名字和用量分开写，做的时候不慌。"));
    var ingRows = el("div");
    ingRows.style.display = "flex";
    ingRows.style.flexDirection = "column";
    ingRows.style.gap = "4px";
    ingField.appendChild(ingRows);
    var addIng = el("button", "vs-addrow", "＋ 加一样食材");
    addIng.type = "button";
    ingField.appendChild(addIng);
    body.appendChild(ingField);

    function addIngredientRow(name, amount) {
      var row = el("div", "vs-row");
      var nameInputRow = el("input", "vs-input");
      nameInputRow.type = "text";
      nameInputRow.placeholder = "食材";
      nameInputRow.value = name || "";
      nameInputRow.setAttribute("aria-label", "食材名称");
      var amountInput = el("input", "vs-input");
      amountInput.type = "text";
      amountInput.placeholder = "用量";
      amountInput.value = amount || "";
      amountInput.setAttribute("aria-label", "食材用量");
      amountInput.style.maxWidth = "38%";
      var del = el("button", "vs-row__del", "×");
      del.type = "button";
      del.setAttribute("aria-label", "删掉这行食材");
      del.addEventListener("click", function () {
        if (ingRows.children.length === 1) {
          nameInputRow.value = "";
          amountInput.value = "";
        } else {
          row.remove();
        }
      });
      append(row, [nameInputRow, amountInput, del]);
      ingRows.appendChild(row);
    }

    addIngredientRow();
    addIngredientRow();
    addIng.addEventListener("click", function () {
      addIngredientRow();
      var rows = ingRows.querySelectorAll(".vs-row");
      var last = rows[rows.length - 1];
      if (last) last.querySelector("input").focus();
    });

    /* 步骤 */
    var stepField = el("div", "vs-field");
    stepField.appendChild(el("span", "vs-field__label", "步骤"));
    var stepRows = el("div");
    stepRows.style.display = "flex";
    stepRows.style.flexDirection = "column";
    stepRows.style.gap = "8px";
    stepField.appendChild(stepRows);
    var addStep = el("button", "vs-addrow", "＋ 加一步");
    addStep.type = "button";
    stepField.appendChild(addStep);
    body.appendChild(stepField);

    function addStepRow(text) {
      var row = el("div", "vs-row");
      var area = el("textarea", "vs-textarea");
      area.rows = 2;
      area.placeholder = "写一步操作";
      area.value = text || "";
      area.setAttribute("aria-label", "操作步骤");
      var del = el("button", "vs-row__del", "×");
      del.type = "button";
      del.setAttribute("aria-label", "删掉这一步");
      del.addEventListener("click", function () {
        if (stepRows.children.length === 1) {
          area.value = "";
        } else {
          row.remove();
        }
      });
      append(row, [area, del]);
      stepRows.appendChild(row);
    }

    addStepRow();
    addStepRow();
    addStep.addEventListener("click", function () {
      addStepRow();
      var areas = stepRows.querySelectorAll("textarea");
      if (areas.length) areas[areas.length - 1].focus();
    });

    /* 备注 */
    var noteField = el("div", "vs-field");
    var noteLabel = el("label", "vs-field__label", "留一句备注");
    noteLabel.setAttribute("for", idBase + "-note");
    var noteInput = el("textarea", "vs-textarea");
    noteInput.id = idBase + "-note";
    noteInput.rows = 2;
    noteInput.placeholder = "比如：番茄要炒到出沙。";
    append(noteField, [noteLabel, noteInput]);
    body.appendChild(noteField);

    /* 底部操作 */
    var cancel = el("button", "vs-btn vs-btn--ghost", "先不写");
    cancel.type = "button";
    cancel.addEventListener("click", function () {
      closeSheet();
    });

    var save = el("button", "vs-btn vs-btn--seal", "存好");
    save.type = "button";

    function buildRecipe() {
      var ingredients = [];
      Array.prototype.forEach.call(ingRows.querySelectorAll(".vs-row"), function (row) {
        var inputs = row.querySelectorAll("input");
        var ingName = inputs[0].value.trim();
        var amount = inputs[1].value.trim();
        if (ingName) ingredients.push({ name: ingName, amount: amount || "适量" });
      });

      var steps = [];
      Array.prototype.forEach.call(stepRows.querySelectorAll("textarea"), function (area) {
        var value = area.value.trim();
        if (value) steps.push(value);
      });

      var tints = ["#e6d3ae", "#e7b49c", "#c9d2ac", "#d8af8a", "#ead3b6", "#e2bc8d"];
      return {
        id: VS.newRecipeId(),
        name: nameInput.value.trim(),
        emoji: "🍲",
        tint: tints[Math.floor(Math.random() * tints.length)],
        minutes: Math.max(1, parseInt(timeInput.value, 10) || 20),
        tags: state.tags.slice(),
        note: noteInput.value.trim(),
        ingredients: ingredients.length ? ingredients : [{ name: "食材", amount: "适量" }],
        steps: steps.length ? steps : ["按自己的习惯来做。"]
      };
    }

    function finalizeSave(recipe) {
      VS.addRecipe(recipe);
      closeSheet();
      toast("收好了，已放进菜谱本。");
      if (typeof options.onSave === "function") options.onSave(recipe);
    }

    save.addEventListener("click", function () {
      var name = nameInput.value.trim();
      var ok = true;
      if (!name) {
        nameError.textContent = "先给这道菜起个名字。";
        nameError.style.display = "";
        nameInput.focus();
        ok = false;
      } else {
        nameError.style.display = "none";
      }
      if (!state.tags.length) {
        tagError.textContent = "至少选一个适合的餐次。";
        tagError.style.display = "";
        ok = false;
      } else {
        tagError.style.display = "none";
      }
      if (!ok) return;

      var recipe = buildRecipe();

      if (state.image && VS.store && VS.store.compressImage && VS.store.saveImage) {
        save.disabled = true;
        save.textContent = "存图中…";
        VS.store
          .compressImage(state.image)
          .then(function (blob) {
            return VS.store.saveImage(blob).then(function (key) {
              recipe.imageKey = key;
              recipe.image = VS.store.blobURL(blob);
              return recipe;
            });
          })
          .catch(function () {
            // 压缩/入库失败时降级为本次会话内嵌预览，不阻塞保存
            recipe.image = state.image;
            return recipe;
          })
          .then(function (finalRecipe) {
            finalizeSave(finalRecipe);
          });
      } else {
        if (state.image) recipe.image = state.image;
        finalizeSave(recipe);
      }
    });

    openSheet({
      title: "写一道新菜",
      subtitle: "写下来，下次就不用想。",
      content: body,
      footer: [cancel, save],
      variant: "full",
      initialFocus: "#" + idBase + "-name"
    });
  };

  /* ---------- 复制本日 ---------- */

  ui.copySheet = function (options) {
    options = options || {};
    var fromKey = options.fromKey || VS.todayKey();
    var source = VS.planFor(fromKey);
    var available = VS.slots.filter(function (slot) {
      return (source[slot.id] || []).length > 0;
    });

    var body = el("div");

    if (!available.length) {
      body.appendChild(emptyState("这天还没有菜可以复制。", "先点一道，再抄到别的日子。"));
      openSheet({
        title: "复制菜单",
        subtitle: VS.dayTitle(fromKey),
        content: body
      });
      return;
    }

    var baseKey = VS.isFuture(fromKey) ? fromKey : VS.todayKey();
    var startDate = VS.addDays(VS.parseDate(baseKey), 1);
    var targets = [];
    for (var i = 0; i < 7; i++) {
      targets.push(VS.dateKey(VS.addDays(startDate, i)));
    }
    var target = targets[0];
    var selectedSlots = available.map(function (slot) {
      return slot.id;
    });

    body.appendChild(el("span", "vs-field__label", "抄到哪一天"));
    var dateRow = el("div", "vs-copy__dates");
    body.appendChild(dateRow);

    var mealWrap = el("div");
    mealWrap.appendChild(el("span", "vs-field__label", "抄哪几餐"));
    var meals = el("div", "vs-copy__meals");
    mealWrap.appendChild(meals);
    body.appendChild(mealWrap);

    function renderDates() {
      clear(dateRow);
      targets.forEach(function (key) {
        var date = VS.parseDate(key);
        var rel = VS.relativeLabel(key);
        var label = (rel || "周" + VS.weekdayCN(date)) + " " + date.getMonth() + 1 + "." + date.getDate();
        var btn = el("button", "vs-copy__date", label);
        btn.type = "button";
        btn.setAttribute("aria-pressed", key === target ? "true" : "false");
        btn.addEventListener("click", function () {
          target = key;
          renderDates();
        });
        dateRow.appendChild(btn);
      });
    }

    function renderMeals() {
      clear(meals);
      available.forEach(function (slot) {
        var on = selectedSlots.indexOf(slot.id) !== -1;
        var btn = el("button", "vs-copy__meal" + (on ? " is-on" : ""));
        btn.type = "button";
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.appendChild(el("span", "vs-pick__check", "✓"));
        btn.appendChild(el("span", "vs-copy__mealname", slot.name));
        btn.appendChild(el("span", "vs-copy__count", (source[slot.id] || []).length + " 道"));
        btn.addEventListener("click", function () {
          var idx = selectedSlots.indexOf(slot.id);
          if (idx === -1) selectedSlots.push(slot.id);
          else selectedSlots.splice(idx, 1);
          renderMeals();
          updateSubmit();
        });
        meals.appendChild(btn);
      });
    }

    var submit = el("button", "vs-btn vs-btn--seal", "复制过去");
    submit.type = "button";

    function updateSubmit() {
      submit.disabled = selectedSlots.length === 0;
    }

    submit.addEventListener("click", function () {
      var snapshot = VS.snapshotPlan(target);
      VS.copyPlan(fromKey, target, selectedSlots);
      closeSheet();
      toast("已复制到 " + VS.dayTitle(target), {
        undo: function () {
          VS.restorePlan(target, snapshot);
        }
      });
      if (typeof options.onCopy === "function") options.onCopy(target);
    });

    renderDates();
    renderMeals();
    updateSubmit();

    openSheet({
      title: "复制本日菜单",
      subtitle: "从 " + VS.dayTitle(fromKey) + " 抄一份过去",
      content: body,
      footer: submit
    });
  };

  /* ---------- 转盘结果 ---------- */

  ui.showWheelResult = function (recipe, options) {
    options = options || {};
    var dateKey = options.dateKey || VS.todayKey();
    var past = VS.isPast(dateKey);
    var slotId = options.defaultSlot;
    if (!slotId && VS.isToday(dateKey)) slotId = VS.currentSlot();

    var body = el("div", "vs-result");

    var top = el("div", "vs-result__top");
    var art = ui.art(recipe, "vs-result__art");
    var main = el("div", "vs-result__main");
    main.appendChild(el("div", "vs-result__name", recipe.name));
    main.appendChild(el("div", "vs-result__meta", metaText(recipe)));
    append(top, [art, main]);
    body.appendChild(top);

    if (recipe.note) {
      body.appendChild(el("div", "vs-result__note", recipe.note));
    }

    var hint = el(
      "p",
      "vs-result__hint",
      past
        ? "过去的日子只能翻看，不能再加点。"
        : slotId
        ? "将放进 " + VS.dayTitle(dateKey) + " · " + VS.slotName(slotId)
        : VS.dayTitle(dateKey) + " · 先选一餐再放进去"
    );
    body.appendChild(hint);

    var primary = el(
      "button",
      "vs-btn vs-btn--block " + (past ? "vs-btn--ghost" : "vs-btn--seal"),
      past ? "只能翻看" : slotId ? "加进" + VS.slotName(slotId) : "选一餐放进去"
    );
    primary.type = "button";

    var secondary = el("div", "vs-result__actions");
    var again = el("button", "vs-btn vs-btn--ghost vs-btn--sm", "换一道");
    again.type = "button";
    again.addEventListener("click", function () {
      closeSheet();
      if (typeof options.onSpinAgain === "function") options.onSpinAgain();
    });
    secondary.appendChild(again);

    if (typeof options.onView === "function") {
      var view = el("button", "vs-btn vs-btn--ghost vs-btn--sm", "看看菜谱");
      view.type = "button";
      view.addEventListener("click", function () {
        closeSheet();
        options.onView(recipe);
      });
      secondary.appendChild(view);
    }

    function addTo(slot) {
      if (VS.isPast(dateKey)) {
        closeSheet();
        toast("过去的日子只能翻看。");
        return;
      }
      var added = VS.addDish(dateKey, slot, recipe.id);
      closeSheet();
      if (added) {
        toast("已放进 " + VS.dayTitle(dateKey) + " · " + VS.slotName(slot), {
          undo: function () {
            VS.removeDish(dateKey, slot, recipe.id);
          }
        });
      } else {
        toast("这道已经在" + VS.slotName(slot) + "里了。");
      }
      if (typeof options.onAdded === "function") options.onAdded(slot);
    }

    primary.addEventListener("click", function () {
      if (slotId) {
        addTo(slotId);
      } else {
        closeSheet();
        ui.slotSheet({
          dateKey: dateKey,
          title: "这道菜放进哪一餐？",
          onPick: function (picked) {
            addTo(picked);
          }
        });
      }
    });

    if (slotId && !past) {
      var change = el("button", "vs-link", "换一餐");
      change.type = "button";
      change.addEventListener("click", function () {
        closeSheet();
        ui.slotSheet({
          dateKey: dateKey,
          preselect: slotId,
          title: "换到哪一餐？",
          onPick: function (picked) {
            addTo(picked);
          }
        });
      });
      hint.appendChild(change);
    }

    body.appendChild(secondary);

    openSheet({
      title: "转盘说，就它了",
      subtitle: VS.dayTitle(dateKey),
      content: body,
      footer: primary,
      initialFocus: ".vs-sheet__foot .vs-btn"
    });
  };
})();
