/* ============================================================
   Demo C · 深夜灶台
   ============================================================ */

(function () {
  "use strict";

  var $ = function (id) {
    return document.getElementById(id);
  };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function todayDishIds() {
    var ids = {};
    var plan = VS.planFor(VS.todayKey());
    VS.slots.forEach(function (slot) {
      (plan[slot.id] || []).forEach(function (id) {
        ids[id] = true;
      });
    });
    return ids;
  }

  function dayLabel(key) {
    return VS.isToday(key) ? "今天" : VS.relativeLabel(key) || VS.shortDate(VS.parseDate(key));
  }

  function getHeroSlot(dateKey) {
    if (VS.isToday(dateKey)) return VS.currentSlot();
    var plan = VS.planFor(dateKey);
    for (var i = 0; i < VS.slots.length; i++) {
      if ((plan[VS.slots[i].id] || []).length) return VS.slots[i].id;
    }
    return null;
  }

  var state = {
    selected: VS.todayKey(),
    calMonth: startOfMonth(new Date()),
    libFilter: "all",
    libQuery: "",
    wheelFilter: VS.currentSlot(),
    avoidToday: false,
    wheel: null,
    wheelHost: null,
    wheelSig: "",
    wheelItems: [],
    wheelPoolSize: 0,
    peekBody: null,
    peekSlot: null,
    peekDate: null,
    calBody: null,
    calSheet: null,
    fanOpen: false,
    drawerOpen: false
  };

  var refs = {
    topDate: $("c-top-date"),
    dates: $("c-dates"),
    banner: $("c-banner"),
    hero: $("c-hero"),
    rail: $("c-rail"),
    othersTitle: $("c-others-title"),
    recent: $("c-recent"),
    fab: $("c-fab"),
    fan: $("c-fan"),
    fanScrim: $("c-fan-scrim"),
    drawer: $("c-drawer"),
    drawerScrim: $("c-drawer-scrim"),
    menuBtn: $("c-open-drawer")
  };

  /* ---------- 首页 ---------- */

  function renderTop() {
    refs.topDate.textContent = VS.shortDate(VS.parseDate(state.selected));
  }

  function renderDateStrip() {
    VS.ui.dateStrip(refs.dates, {
      selected: state.selected,
      onChange: function (key) {
        state.selected = key;
        state.calMonth = startOfMonth(VS.parseDate(key));
        renderHome();
      }
    });

    window.requestAnimationFrame(function () {
      var active = refs.dates.querySelector(".is-active");
      if (!active) return;
      refs.dates.scrollLeft = Math.max(
        0,
        active.offsetLeft - (refs.dates.clientWidth - active.offsetWidth) / 2
      );
    });
  }

  function renderBanner() {
    clear(refs.banner);
    refs.banner.className = "c-banner";
    if (VS.isPast(state.selected)) {
      refs.banner.classList.add("is-past");
      refs.banner.appendChild(el("span", "vs-stamp", "只读"));
      refs.banner.appendChild(el("p", null, "这页已经过去了，只能翻看。想复刻就复制到之后。"));
    } else if (VS.isFuture(state.selected)) {
      refs.banner.appendChild(el("span", "vs-stamp", "提前备菜"));
      refs.banner.appendChild(
        el("p", null, "正在为 " + VS.dayTitle(state.selected) + " 备菜，点菜时会先问放进哪一餐。")
      );
    } else {
      refs.banner.classList.add("is-hidden");
    }
  }

  function renderHero() {
    clear(refs.hero);
    var dateKey = state.selected;
    var plan = VS.planFor(dateKey);
    var total = VS.dayDishCount(dateKey);
    var today = VS.isToday(dateKey);
    var future = VS.isFuture(dateKey);
    var past = VS.isPast(dateKey);
    var slotId = getHeroSlot(dateKey);
    var slot = slotId ? VS.slotMap[slotId] : null;
    var ids = slot ? (plan[slotId] || []).slice() : [];

    var meta = el("div", "c-hero__meta");
    meta.appendChild(el("span", "c-hero__now", today ? "现在" : future ? "备菜" : "旧页"));
    if (slot) {
      meta.appendChild(el("span", "c-hero__slot", slot.name));
      meta.appendChild(el("span", "c-hero__time", VS.slotRangeText(slot)));
    } else {
      meta.appendChild(
        el(
          "span",
          "c-hero__slot",
          future
            ? "为" + (VS.relativeLabel(dateKey) || "周" + VS.weekdayCN(VS.parseDate(dateKey))) + "备菜"
            : "这天没开火"
        )
      );
    }
    refs.hero.appendChild(meta);

    var title;
    if (today) {
      if (!slot) title = "这一餐还空着。";
      else title = ids.length ? slot.name + "，已经想好了。" : slot.name + "还空着。";
    } else if (future) {
      title = ids.length ? "这天的饭，已经有着落。" : "提前把饭想好。";
    } else {
      title = ids.length ? "那天吃过这些。" : "那天没开火。";
    }
    refs.hero.appendChild(el("h1", "c-hero__title", title));

    var ticket = el("div", "c-hero__ticket");
    var tape = el("span", "vs-tape c-hero__tape");
    tape.setAttribute("aria-hidden", "true");
    ticket.appendChild(tape);

    if (ids.length) {
      ids.forEach(function (id) {
        var recipe = VS.getRecipe(id);
        if (!recipe) return;
        var dish = el("button", "c-dish");
        dish.type = "button";
        dish.setAttribute("aria-label", "查看 " + recipe.name);
        dish.appendChild(el("span", "c-dish__emoji", recipe.emoji || "🍲"));
        var main = el("span", "c-dish__main");
        main.appendChild(el("span", "c-dish__name", recipe.name));
        main.appendChild(
          el(
            "span",
            "c-dish__meta",
            (recipe.minutes ? recipe.minutes + " 分钟 · " : "") +
              (recipe.ingredients || []).length +
              " 样食材"
          )
        );
        dish.appendChild(main);
        dish.appendChild(el("span", "c-dish__arrow", "›"));
        dish.addEventListener("click", function () {
          openRecipe(recipe);
        });
        ticket.appendChild(dish);
      });
    } else {
      var empty = el("div", "c-hero__empty");
      empty.appendChild(el("span", "c-hero__empty-emoji", "🍽️"));
      if (slot) {
        empty.appendChild(el("p", null, "这一餐还空着，点一道。"));
        empty.appendChild(el("small", null, "也可以去转盘，让运气替你决定。"));
      } else if (future) {
        empty.appendChild(el("p", null, "这一天还没开火，先点一道。"));
        empty.appendChild(el("small", null, "提前点菜时，会先问你放进哪一餐。"));
      } else {
        empty.appendChild(el("p", null, "这天没有留下饭菜。"));
      }
      ticket.appendChild(empty);
    }

    var actions = el("div", "c-hero__ticketactions");
    var countText = ids.length ? "这餐 " + ids.length + " 道" : "这餐还空着";
    if (total > ids.length) countText += " · 全天 " + total + " 道";
    actions.appendChild(el("span", "c-hero__count", countText));

    var buttons = el("div", "c-hero__buttons");
    if (!past) {
      var add = el("button", "c-hero__btn c-hero__btn--seal", slot ? "＋ 加一道" : "＋ 点一道");
      add.type = "button";
      add.addEventListener("click", function () {
        if (slot) openPicker(slotId);
        else openSlotSheetGeneral();
      });
      buttons.appendChild(add);
    }
    if (total) {
      var copy = el("button", "c-hero__btn", past ? "复制这天" : "复制本日");
      copy.type = "button";
      copy.addEventListener("click", function () {
        VS.ui.copySheet({ fromKey: dateKey });
      });
      buttons.appendChild(copy);
    }
    actions.appendChild(buttons);
    ticket.appendChild(actions);
    refs.hero.appendChild(ticket);
  }

  function renderRail() {
    clear(refs.rail);
    var dateKey = state.selected;
    var plan = VS.planFor(dateKey);
    var today = VS.isToday(dateKey);
    var heroSlot = getHeroSlot(dateKey);
    var current = VS.currentSlot();

    refs.othersTitle.textContent = today
      ? "今天还有"
      : VS.isFuture(dateKey)
      ? "这天还有"
      : "这天的其他餐";

    VS.slots.forEach(function (slot) {
      if (slot.id === heroSlot) return;
      var ids = (plan[slot.id] || []).slice();
      var card = el("button", "c-mini");
      card.type = "button";
      card.setAttribute("aria-label", "查看" + slot.name + "，已有 " + ids.length + " 道菜");
      if (ids.length) card.classList.add("is-planned");
      if (today && current === slot.id) card.classList.add("is-now");

      var top = el("span", "c-mini__top");
      top.appendChild(el("span", "c-mini__glyph", slot.glyph));
      top.appendChild(el("span", "c-mini__name", slot.name));
      top.appendChild(el("span", "c-mini__count", ids.length ? String(ids.length) : "—"));
      card.appendChild(top);

      if (ids.length) {
        var first = VS.getRecipe(ids[0]);
        var text = first ? first.name : "已有安排";
        if (ids.length > 1) text += " 等 " + ids.length + " 道";
        card.appendChild(el("span", "c-mini__dish", text));
      } else {
        card.appendChild(el("span", "c-mini__empty", "还空着"));
      }

      if (today && current === slot.id) card.appendChild(el("span", "c-mini__now", "现在"));

      card.addEventListener("click", function () {
        openSlotPeek(slot.id);
      });
      refs.rail.appendChild(card);
    });
  }

  function renderRecent() {
    clear(refs.recent);
    VS.recentRecipes(5).forEach(function (recipe) {
      var card = el("button", "c-recipe");
      card.type = "button";
      card.setAttribute("aria-label", "查看 " + recipe.name);
      card.appendChild(VS.ui.art(recipe));
      card.appendChild(el("span", "c-recipe__name", recipe.name));
      card.addEventListener("click", function () {
        openRecipe(recipe);
      });
      refs.recent.appendChild(card);
    });

    var newCard = el("button", "c-recipe--new", "＋\n写一道新的");
    newCard.type = "button";
    newCard.style.whiteSpace = "pre-line";
    newCard.addEventListener("click", openForm);
    refs.recent.appendChild(newCard);
  }

  function renderHome() {
    renderTop();
    renderDateStrip();
    renderBanner();
    renderHero();
    renderRail();
    renderRecent();
    updateDrawerCount();
  }

  /* ---------- 点菜 ---------- */

  function openRecipe(recipe) {
    VS.ui.recipeDetail(recipe, { onOrder: orderFlow });
  }

  function orderFlow(recipe) {
    if (VS.isPast(state.selected)) {
      VS.ui.toast("过去的日子只能翻看。");
      return;
    }
    VS.ui.slotSheet({
      dateKey: state.selected,
      preselect: VS.isToday(state.selected) ? VS.currentSlot() : null,
      onPick: function (slotId) {
        addOne(recipe, slotId);
      }
    });
  }

  function addOne(recipe, slotId) {
    var added = VS.addDish(state.selected, slotId, recipe.id);
    if (added) {
      VS.ui.toast("已放进 " + dayLabel(state.selected) + " · " + VS.slotName(slotId), {
        undo: function () {
          VS.removeDish(state.selected, slotId, recipe.id);
        }
      });
    } else {
      VS.ui.toast("这道已经在" + VS.slotName(slotId) + "里了。");
    }
  }

  function openSlotSheetGeneral() {
    if (VS.isPast(state.selected)) {
      VS.ui.toast("过去的日子只能翻看。");
      return;
    }
    VS.ui.slotSheet({
      dateKey: state.selected,
      preselect: VS.isToday(state.selected) ? VS.currentSlot() : null,
      onPick: function (slotId) {
        openPicker(slotId);
      }
    });
  }

  function openPicker(slotId) {
    if (VS.isPast(state.selected)) {
      VS.ui.toast("过去的日子只能翻看。");
      return;
    }
    VS.ui.recipePicker({
      dateKey: state.selected,
      slotId: slotId,
      onDone: refresh
    });
  }

  function openSlotPeek(slotId) {
    var dateKey = state.selected;
    var past = VS.isPast(dateKey);
    var body = el("div");
    state.peekBody = body;
    state.peekSlot = slotId;
    state.peekDate = dateKey;
    renderSlotPeekBody(body, slotId, dateKey);

    var footer = null;
    if (!past) {
      footer = el("button", "vs-btn vs-btn--seal", "＋ 加一道");
      footer.type = "button";
      footer.addEventListener("click", function () {
        openPicker(slotId);
      });
    }

    VS.ui.openSheet({
      title: VS.slotName(slotId),
      subtitle: VS.dayTitle(dateKey) + (past ? " · 只读" : ""),
      content: body,
      footer: footer,
      onClose: function () {
        state.peekBody = null;
      }
    });
  }

  function renderSlotPeekBody(body, slotId, dateKey) {
    clear(body);
    var ids = (VS.planFor(dateKey)[slotId] || []).slice();
    var slot = VS.slotMap[slotId];

    body.appendChild(
      el(
        "p",
        "vs-field__hint",
        (ids.length ? "已有 " + ids.length + " 道" : "还空着") +
          " · " +
          (slot ? VS.slotRangeText(slot) : "")
      )
    );

    if (!ids.length) {
      var empty = el("div", "vs-empty", "这一餐还空着。");
      empty.appendChild(el("small", null, VS.isPast(dateKey) ? "这天只能翻看。" : "点一道加进来。"));
      body.appendChild(empty);
      return;
    }

    ids.forEach(function (id) {
      var recipe = VS.getRecipe(id);
      if (!recipe) return;
      var row = el("button", "vs-pick");
      row.type = "button";
      row.appendChild(VS.ui.art(recipe, "vs-pick__art"));
      var main = el("span", "vs-pick__main");
      main.appendChild(el("span", "vs-pick__name", recipe.name));
      main.appendChild(el("span", "vs-pick__meta", VS.ui.metaText(recipe)));
      row.appendChild(main);
      row.appendChild(el("span", "c-mini__count", "›"));
      row.addEventListener("click", function () {
        openRecipe(recipe);
      });
      body.appendChild(row);
    });
  }

  /* ---------- 菜谱库 ---------- */

  function openLibrary() {
    var content = el("div", "c-lib");

    var head = el("div", "c-lib__head");
    var close = el("button", "c-overlay__close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "关闭菜谱库");
    close.addEventListener("click", function () {
      VS.ui.closeSheet();
    });
    head.appendChild(close);

    var titles = el("div", "c-overlay__titles");
    titles.appendChild(el("h2", null, "菜谱库"));
    var count = el("p", null, "一共 " + VS.recipes.length + " 道");
    count.id = "c-lib-count";
    titles.appendChild(count);
    head.appendChild(titles);

    var write = el("button", "c-overlay__action", "＋ 写一道");
    write.type = "button";
    write.addEventListener("click", function () {
      VS.ui.recipeForm({
        onSave: function () {
          state.libFilter = "all";
          state.libQuery = "";
          var search = document.getElementById("c-lib-search");
          if (search) search.value = "";
          renderLibraryChips();
          renderLibraryGrid();
        }
      });
    });
    head.appendChild(write);
    content.appendChild(head);

    var tools = el("div", "c-lib__tools");
    var search = el("input", "c-lib__search");
    search.id = "c-lib-search";
    search.type = "search";
    search.placeholder = "找菜名，也可以搜食材";
    search.value = state.libQuery;
    search.setAttribute("aria-label", "搜索菜谱");
    search.addEventListener("input", function () {
      state.libQuery = search.value;
      renderLibraryGrid();
    });
    tools.appendChild(search);

    var chips = el("div", "c-lib__chips");
    chips.id = "c-lib-chips";
    tools.appendChild(chips);
    content.appendChild(tools);

    var grid = el("div", "c-lib__grid");
    grid.id = "c-lib-grid";
    content.appendChild(grid);

    VS.ui.openSheet({
      variant: "full",
      bare: true,
      label: "菜谱库",
      content: content
    });

    renderLibraryChips();
    renderLibraryGrid();
  }

  function libRecipes() {
    var base = state.libQuery ? VS.searchRecipes(state.libQuery) : VS.recipes.slice();
    if (state.libFilter !== "all") {
      base = base.filter(function (recipe) {
        return recipe.tags.indexOf(state.libFilter) !== -1;
      });
    }
    return base;
  }

  function renderLibraryChips() {
    var chips = document.getElementById("c-lib-chips");
    if (!chips) return;
    clear(chips);
    var options = [{ id: "all", name: "全部" }].concat(
      VS.slots.map(function (slot) {
        return { id: slot.id, name: slot.name };
      })
    );
    options.forEach(function (option) {
      var chip = el("button", "vs-chip", option.name);
      chip.type = "button";
      chip.setAttribute("aria-pressed", state.libFilter === option.id ? "true" : "false");
      chip.addEventListener("click", function () {
        state.libFilter = option.id;
        renderLibraryChips();
        renderLibraryGrid();
      });
      chips.appendChild(chip);
    });
  }

  function renderLibraryGrid() {
    var grid = document.getElementById("c-lib-grid");
    if (!grid) return;
    clear(grid);
    var recipes = libRecipes();

    var count = document.getElementById("c-lib-count");
    if (count) {
      count.textContent =
        state.libQuery || state.libFilter !== "all"
          ? "找到 " + recipes.length + " 道 · 共 " + VS.recipes.length + " 道"
          : "一共 " + VS.recipes.length + " 道";
    }

    if (!recipes.length) {
      grid.appendChild(el("div", "c-lib__empty", "没有找到这道菜。换个词，或者写一道新的。"));
      return;
    }

    recipes.forEach(function (recipe) {
      var card = el("button", "c-lib-card");
      card.type = "button";
      card.setAttribute("aria-label", "查看 " + recipe.name);
      card.appendChild(VS.ui.art(recipe));
      if (recipe.tags.length) {
        card.appendChild(el("span", "c-lib-card__tag", VS.slotName(recipe.tags[0])));
      }
      card.appendChild(el("span", "c-lib-card__name", recipe.name));
      card.appendChild(el("span", "c-lib-card__meta", VS.ui.metaText(recipe)));
      card.addEventListener("click", function () {
        openRecipe(recipe);
      });
      grid.appendChild(card);
    });
  }

  function refreshLibrary() {
    if (!document.getElementById("c-lib-grid")) return;
    renderLibraryGrid();
  }

  /* ---------- 日历 ---------- */

  function openCalendar() {
    var body = el("div", "c-calendar-body");
    body.id = "c-calendar-body";

    var done = el("button", "vs-btn vs-btn--seal", "看这天的餐单");
    done.type = "button";
    done.addEventListener("click", function () {
      VS.ui.closeSheet();
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });

    var sheet = VS.ui.openSheet({
      title: "翻日历",
      subtitle: "有红点的日子都开过火",
      content: body,
      footer: done,
      onClose: function () {
        state.calBody = null;
        state.calSheet = null;
      }
    });

    state.calBody = body;
    state.calSheet = sheet;
    renderCalendarBody(body, sheet);
  }

  function renderCalendarBody(container, sheet) {
    if (!container || !container.isConnected) return;
    clear(container);
    var calendar = el("div");
    container.appendChild(calendar);

    VS.ui.calendar(calendar, {
      month: state.calMonth,
      selected: state.selected,
      onMonthChange: function (month) {
        state.calMonth = month;
        renderCalendarBody(container, sheet);
      },
      onSelect: function (key) {
        state.selected = key;
        state.calMonth = startOfMonth(VS.parseDate(key));
        renderHome();
        renderCalendarBody(container, sheet);
      },
      onToday: function () {
        state.selected = VS.todayKey();
        state.calMonth = startOfMonth(new Date());
        renderHome();
        renderCalendarBody(container, sheet);
      }
    });

    var count = VS.dayDishCount(state.selected);
    if (sheet) {
      sheet.setSubtitle(VS.dayTitle(state.selected) + " · " + (count ? count + " 道" : "还空着"));
    }

    var summary = el("div", "c-calsummary");
    summary.appendChild(el("h3", null, VS.dayTitle(state.selected)));
    summary.appendChild(
      el(
        "p",
        null,
        (VS.isFuture(state.selected)
          ? "提前备菜 · "
          : VS.isPast(state.selected)
          ? "只读 · "
          : "") + (count ? "已点 " + count + " 道" : "这天还没开火")
      )
    );

    var slots = el("div", "c-calsummary__slots");
    VS.slots.forEach(function (slot) {
      var n = (VS.planFor(state.selected)[slot.id] || []).length;
      var chip = el("span", "c-calsummary__slot" + (n ? " is-on" : ""), slot.name + " " + (n || "—"));
      slots.appendChild(chip);
    });
    summary.appendChild(slots);
    container.appendChild(summary);
  }

  function refreshCalendar() {
    if (state.calBody && state.calBody.isConnected) {
      renderCalendarBody(state.calBody, state.calSheet);
    }
  }

  /* ---------- 转盘覆盖层 ---------- */

  function openWheel() {
    var content = el("div", "c-overlay c-wheel-overlay");

    var head = el("div", "c-overlay__head");
    var close = el("button", "c-overlay__close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "关闭转盘");
    close.addEventListener("click", function () {
      VS.ui.closeSheet();
    });
    head.appendChild(close);

    var titles = el("div", "c-overlay__titles");
    titles.appendChild(el("h2", null, "转一转"));
    titles.appendChild(el("p", null, "先选一餐，剩下的交给运气。"));
    head.appendChild(titles);
    head.appendChild(el("span", "c-overlay__date", VS.shortDate(VS.parseDate(state.selected))));
    content.appendChild(head);

    var stage = el("div", "c-wheelstage");
    var canvas = el("div");
    canvas.id = "c-wheel-canvas";
    stage.appendChild(canvas);
    content.appendChild(stage);

    content.appendChild(
      el("p", "c-wheel-note", "转到哪道，就把它放进这一天的一餐。点轮心那个「转」字。")
    );

    var filters = el("div", "vs-chiprow c-wheel-filters");
    filters.id = "c-wheel-filters";
    content.appendChild(filters);

    var switchLabel = el("label", "c-switch");
    var avoid = el("input");
    avoid.type = "checkbox";
    avoid.id = "c-wheel-avoid";
    avoid.checked = state.avoidToday;
    var box = el("span", "c-switch__box");
    box.setAttribute("aria-hidden", "true");
    switchLabel.appendChild(avoid);
    switchLabel.appendChild(box);
    switchLabel.appendChild(el("span", null, "避开今天已经点过的菜"));
    content.appendChild(switchLabel);

    var cand = el("p", "c-wheelcand");
    cand.id = "c-wheel-cand";
    content.appendChild(cand);

    VS.ui.openSheet({
      variant: "full",
      bare: true,
      label: "随机转盘",
      content: content,
      onClose: function () {
        state.wheel = null;
        state.wheelHost = null;
        state.wheelSig = "";
        state.wheelItems = [];
      }
    });

    state.wheelHost = canvas;
    state.wheel = null;
    state.wheelSig = "";
    state.wheelItems = [];

    avoid.addEventListener("change", function () {
      state.avoidToday = avoid.checked;
      ensureWheel(true);
    });

    renderWheelFilters();
    ensureWheel(true);
  }

  function wheelPool() {
    var pool =
      state.wheelFilter === "all" ? VS.recipes.slice() : VS.recipesFor(state.wheelFilter);
    if (state.avoidToday) {
      var ids = todayDishIds();
      pool = pool.filter(function (recipe) {
        return !ids[recipe.id];
      });
    }
    return pool;
  }

  function renderWheelFilters() {
    var filters = document.getElementById("c-wheel-filters");
    if (!filters) return;
    clear(filters);
    var options = [{ id: "all", name: "全部" }].concat(
      VS.slots.map(function (slot) {
        return { id: slot.id, name: slot.name };
      })
    );
    options.forEach(function (option) {
      var chip = el("button", "vs-chip", option.name);
      chip.type = "button";
      chip.setAttribute("aria-pressed", state.wheelFilter === option.id ? "true" : "false");
      chip.addEventListener("click", function () {
        state.wheelFilter = option.id;
        renderWheelFilters();
        ensureWheel(true);
      });
      filters.appendChild(chip);
    });
  }

  function updateWheelCand(poolSize) {
    var cand = document.getElementById("c-wheel-cand");
    if (!cand) return;
    clear(cand);
    if (!state.wheelItems.length) {
      cand.appendChild(
        document.createTextNode("这一组暂时没有菜，换个时段，或者关掉「避开今天」看看。")
      );
      return;
    }
    var names = state.wheelItems
      .map(function (recipe) {
        return recipe.name;
      })
      .join("、");
    var text = "这一轮 " + state.wheelItems.length + " 道：" + names;
    if (poolSize > state.wheelItems.length) {
      text += "（从 " + poolSize + " 道里挑了 " + state.wheelItems.length + " 道）";
    }
    cand.appendChild(document.createTextNode(text));
  }

  function ensureWheel(force) {
    if (!state.wheelHost || !state.wheelHost.isConnected) return;
    var pool = wheelPool();
    var sig =
      state.wheelFilter +
      "|" +
      (state.avoidToday ? "1" : "0") +
      "|" +
      VS.recipes
        .map(function (recipe) {
          return recipe.id;
        })
        .join(",") +
      "|" +
      (state.avoidToday ? JSON.stringify(VS.planFor(VS.todayKey())) : "");

    if (!force && state.wheel && state.wheelSig === sig) {
      updateWheelCand(pool.length);
      return;
    }
    if (state.wheel && state.wheel.isSpinning()) return;

    var chosen = shuffle(pool.slice()).slice(0, 8);
    if (!state.wheel) {
      state.wheel = VS.createWheel(state.wheelHost, {
        items: chosen,
        onResult: handleWheelResult
      });
    } else {
      state.wheel.setItems(chosen);
    }
    state.wheelSig = sig;
    state.wheelItems = chosen;
    state.wheelPoolSize = pool.length;
    updateWheelCand(pool.length);
  }

  function handleWheelResult(recipe) {
    VS.ui.showWheelResult(recipe, {
      dateKey: state.selected,
      defaultSlot: VS.isToday(state.selected) ? VS.currentSlot() : null,
      onSpinAgain: function () {
        window.setTimeout(function () {
          if (state.wheel && !state.wheel.isSpinning()) state.wheel.spin();
        }, 180);
      },
      onView: function (dish) {
        VS.ui.recipeDetail(dish, { onOrder: orderFlow });
      }
    });
  }

  function refreshWheel() {
    if (state.wheelHost && state.wheelHost.isConnected) ensureWheel(false);
  }

  /* ---------- 写菜谱 ---------- */

  function openForm() {
    VS.ui.recipeForm();
  }

  /* ---------- FAB 与抽屉 ---------- */

  function fanInertTargets() {
    return [document.querySelector(".c-top"), document.querySelector(".c-main")];
  }

  function setFan(open) {
    state.fanOpen = open;
    refs.fan.classList.toggle("is-open", open);
    refs.fanScrim.classList.toggle("is-open", open);
    refs.fab.classList.toggle("is-open", open);
    refs.fan.setAttribute("aria-hidden", open ? "false" : "true");
    refs.fab.setAttribute("aria-expanded", open ? "true" : "false");
    fanInertTargets().forEach(function (node) {
      if (!node) return;
      if (open) node.setAttribute("inert", "");
      else node.removeAttribute("inert");
    });
    if (open) {
      window.setTimeout(function () {
        var first = refs.fan.querySelector(".c-fan__item");
        if (first) first.focus();
      }, 120);
    } else {
      refs.fab.focus({ preventScroll: true });
    }
  }

  function closeFan(focusFab) {
    if (!state.fanOpen) return;
    state.fanOpen = false;
    refs.fan.classList.remove("is-open");
    refs.fanScrim.classList.remove("is-open");
    refs.fab.classList.remove("is-open");
    refs.fan.setAttribute("aria-hidden", "true");
    refs.fab.setAttribute("aria-expanded", "false");
    fanInertTargets().forEach(function (node) {
      if (node) node.removeAttribute("inert");
    });
    if (focusFab) refs.fab.focus({ preventScroll: true });
  }

  function drawerInertTargets() {
    return [
      document.querySelector(".c-top"),
      document.querySelector(".c-main"),
      refs.fab,
      refs.fan,
      refs.fanScrim
    ];
  }

  function openDrawer() {
    if (state.fanOpen) closeFan(false);
    state.drawerOpen = true;
    refs.drawer.classList.add("is-open");
    refs.drawerScrim.classList.add("is-open");
    refs.drawer.setAttribute("aria-hidden", "false");
    refs.menuBtn.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("c-drawer-open");
    drawerInertTargets().forEach(function (node) {
      if (node) node.setAttribute("inert", "");
    });
    updateDrawerCount();
    window.setTimeout(function () {
      var first = refs.drawer.querySelector(".c-drawer__item");
      if (first) first.focus();
    }, 120);
  }

  function closeDrawer(focusBtn) {
    if (!state.drawerOpen) return;
    state.drawerOpen = false;
    refs.drawer.classList.remove("is-open");
    refs.drawerScrim.classList.remove("is-open");
    refs.drawer.setAttribute("aria-hidden", "true");
    refs.menuBtn.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("c-drawer-open");
    drawerInertTargets().forEach(function (node) {
      if (node) node.removeAttribute("inert");
    });
    if (focusBtn) refs.menuBtn.focus({ preventScroll: true });
  }

  function updateDrawerCount() {
    var node = document.getElementById("c-drawer-libcount");
    if (node) node.textContent = VS.recipes.length + " 道";
  }

  function openAbout() {
    var body = el("div", "c-about");
    body.appendChild(el("p", null, "火山严选是一本自己的菜谱：想吃什么就写下来，不知道吃什么就转一下。"));
    body.appendChild(el("p", null, "这一天有红点，说明开过火。提前点菜时，会先问放进哪一餐。"));
    body.appendChild(el("p", null, "这是静态视觉原型：新增只在本次浏览里生效，刷新就回到示例数据。"));
    VS.ui.openSheet({ title: "关于火山严选", content: body });
  }

  /* ---------- 总刷新 ---------- */

  function refresh() {
    renderHome();
    refreshLibrary();
    refreshCalendar();
    refreshWheel();
    if (state.peekBody && state.peekBody.isConnected && state.peekSlot) {
      renderSlotPeekBody(state.peekBody, state.peekSlot, state.peekDate);
    }
  }

  /* ---------- 事件 ---------- */

  refs.menuBtn.addEventListener("click", openDrawer);
  $("c-close-drawer").addEventListener("click", function () {
    closeDrawer(true);
  });
  refs.drawerScrim.addEventListener("click", function () {
    closeDrawer(true);
  });

  Array.prototype.forEach.call(refs.drawer.querySelectorAll("[data-open]"), function (btn) {
    btn.addEventListener("click", function () {
      var action = btn.dataset.open;
      closeDrawer(false);
      if (action === "library") openLibrary();
      else if (action === "calendar") openCalendar();
      else openAbout();
    });
  });

  refs.fab.addEventListener("click", function () {
    setFan(!state.fanOpen);
  });

  refs.fanScrim.addEventListener("click", function () {
    closeFan(true);
  });

  Array.prototype.forEach.call(refs.fan.querySelectorAll("[data-action]"), function (btn) {
    btn.addEventListener("click", function () {
      var action = btn.dataset.action;
      closeFan(false);
      if (action === "order") openSlotSheetGeneral();
      else if (action === "wheel") openWheel();
      else openForm();
    });
  });

  $("c-order-all").addEventListener("click", openSlotSheetGeneral);
  $("c-open-lib").addEventListener("click", openLibrary);

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (document.querySelector(".vs-sheet")) return;
    if (state.fanOpen) {
      event.preventDefault();
      closeFan(true);
      return;
    }
    if (state.drawerOpen) {
      event.preventDefault();
      closeDrawer(true);
    }
  });

  VS.onChange = refresh;

  renderHome();
})();
