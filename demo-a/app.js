/* ============================================================
   Demo A · 餐牌厨房
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

  var state = {
    view: "today",
    selected: VS.todayKey(),
    calMonth: startOfMonth(new Date()),
    recipeFilter: "all",
    query: "",
    wheelFilter: VS.currentSlot(),
    avoidToday: false,
    wheel: null,
    wheelSig: "",
    wheelItems: [],
    wheelPoolSize: 0,
    entrance: true,
    initialScroll: true
  };

  var refs = {
    dates: $("a-dates"),
    future: $("a-future"),
    slips: $("a-slips"),
    summary: $("a-summary"),
    recent: $("a-recent"),
    recipeCount: $("a-recipe-count"),
    filters: $("a-filters"),
    grid: $("a-grid"),
    search: $("a-search"),
    wheelFilters: $("a-wheel-filters"),
    avoid: $("a-avoid"),
    wheel: $("a-wheel"),
    wheelCand: $("a-wheel-cand"),
    calendar: $("a-calendar"),
    day: $("a-day")
  };

  /* ---------- 渲染：页头与日期 ---------- */

  function renderHeader() {
    var date = VS.parseDate(state.selected);
    $("a-head-md").textContent = VS.shortDate(date);
    $("a-head-wd").textContent = VS.isToday(state.selected)
      ? "今天"
      : "周" + VS.weekdayCN(date);

    var greeting = $("a-greeting");
    var sub = $("a-sub");
    var slot = VS.slotMap[VS.currentSlot()];

    if (VS.isToday(state.selected)) {
      greeting.textContent = "今天想吃点什么？";
      sub.textContent = "现在是" + slot.name + " · " + VS.slotRangeText(slot) + "。";
    } else if (VS.isFuture(state.selected)) {
      greeting.textContent = "提前把饭想好";
      sub.textContent = "为 " + VS.dayTitle(state.selected) + " 备菜，点菜时先选一餐。";
    } else {
      greeting.textContent = "这天吃过什么？";
      sub.textContent = "过去的餐单只能翻看，不能再加菜。";
    }
  }

  function renderDateStrip() {
    VS.ui.dateStrip(refs.dates, {
      selected: state.selected,
      onChange: selectDate
    });

    window.requestAnimationFrame(function () {
      var active = refs.dates.querySelector(".is-active");
      if (!active) return;
      var target = active.offsetLeft - (refs.dates.clientWidth - active.offsetWidth) / 2;
      refs.dates.scrollLeft = Math.max(0, target);
    });
  }

  function selectDate(key) {
    state.selected = key;
    state.calMonth = startOfMonth(VS.parseDate(key));
    renderAll();
  }

  function renderBanner() {
    clear(refs.future);
    refs.future.className = "a-banner";

    if (VS.isPast(state.selected)) {
      refs.future.classList.add("is-past");
      refs.future.appendChild(el("span", "vs-stamp", "只读"));
      refs.future.appendChild(
        el("p", null, "这天已经过去了，只能翻看。想做的话，去今天或明天的餐牌。")
      );
    } else if (VS.isFuture(state.selected)) {
      refs.future.appendChild(el("span", "vs-stamp", "提前备菜"));
      refs.future.appendChild(
        el("p", null, "正在为 " + VS.dayTitle(state.selected) + " 备菜 · 点菜时会先问放进哪一餐。")
      );
    } else {
      refs.future.classList.add("is-hidden");
    }
  }

  /* ---------- 渲染：晾衣绳 + 五餐 ---------- */

  function renderSlips() {
    clear(refs.slips);
    var plan = VS.planFor(state.selected);
    var past = VS.isPast(state.selected);
    var today = VS.isToday(state.selected);
    var current = VS.currentSlot();

    VS.slots.forEach(function (slot, index) {
      var ids = (plan[slot.id] || []).slice();
      var slip = el("article", "a-slip");
      slip.dataset.slot = slot.id;
      if (!ids.length) slip.classList.add("is-empty");
      if (today && current === slot.id) slip.classList.add("is-now");
      if (state.entrance) {
        slip.classList.add("a-slip--enter");
        slip.style.setProperty("--i", String(index));
      }

      slip.appendChild(el("span", "a-pin"));
      if (today && current === slot.id) slip.appendChild(el("span", "a-now", "现在"));

      var head = el("div", "a-slip__head");
      head.appendChild(el("span", "a-slip__meal", slot.name));
      if (ids.length) head.appendChild(el("span", "a-slip__n", String(ids.length)));
      slip.appendChild(head);

      var dishWrap = el("div", "a-slip__dishes");
      if (!ids.length) {
        dishWrap.appendChild(el("div", "a-slip__empty", "还空着"));
      } else {
        ids.slice(0, 3).forEach(function (id) {
          var recipe = VS.getRecipe(id);
          if (!recipe) return;
          var dish = el("button", "a-slip__dish");
          dish.type = "button";
          dish.setAttribute("aria-label", "查看 " + recipe.name);
          dish.appendChild(el("em", null, recipe.emoji || "🍲"));
          dish.appendChild(el("span", null, recipe.name));
          dish.addEventListener("click", function () {
            openRecipe(recipe);
          });
          dishWrap.appendChild(dish);
        });
        if (ids.length > 3) {
          dishWrap.appendChild(el("div", "a-slip__more", "还有 " + (ids.length - 3) + " 道"));
        }
      }
      slip.appendChild(dishWrap);

      if (past) {
        slip.appendChild(el("div", "a-slip__sealed", "只可翻看"));
      } else {
        var add = el("button", "a-slip__add", ids.length ? "＋ 加一道" : "＋ 点一道");
        add.type = "button";
        add.setAttribute("aria-label", "给" + slot.name + "点菜");
        add.addEventListener("click", function () {
          openPicker(slot.id);
        });
        slip.appendChild(add);
      }

      refs.slips.appendChild(slip);
    });

    if (state.initialScroll && today) {
      state.initialScroll = false;
      window.requestAnimationFrame(function () {
        var now = refs.slips.querySelector(".is-now");
        if (!now) return;
        var target = now.offsetLeft - (refs.slips.clientWidth - now.offsetWidth) / 2;
        refs.slips.scrollLeft = Math.max(0, target);
      });
    }
  }

  function renderSummary() {
    clear(refs.summary);
    var count = VS.dayDishCount(state.selected);
    var label = VS.isToday(state.selected)
      ? "今天"
      : VS.shortDate(VS.parseDate(state.selected)) + " 周" + VS.weekdayCN(VS.parseDate(state.selected));

    var text = el("span", "a-summary__text");
    text.appendChild(el("strong", null, label));
    text.appendChild(document.createTextNode(count ? " · 已点 " + count + " 道" : " · 还没开火"));
    refs.summary.appendChild(text);

    var copy = el("button", "vs-link", "复制本日");
    copy.type = "button";
    copy.addEventListener("click", function () {
      VS.ui.copySheet({ fromKey: state.selected });
    });
    refs.summary.appendChild(copy);

    var wheel = el("button", "vs-link vs-link--seal", "摇一道 ›");
    wheel.type = "button";
    wheel.addEventListener("click", function () {
      setView("wheel");
    });
    refs.summary.appendChild(wheel);
  }

  function renderRecent() {
    clear(refs.recent);
    VS.recentRecipes(5).forEach(function (recipe) {
      var card = el("button", "a-recent__card");
      card.type = "button";
      card.setAttribute("aria-label", "查看 " + recipe.name);
      card.appendChild(VS.ui.art(recipe));
      card.appendChild(el("span", "a-recent__name", recipe.name));
      card.addEventListener("click", function () {
        openRecipe(recipe);
      });
      refs.recent.appendChild(card);
    });

    var newCard = el("button", "a-recent__new", "＋\n写一道新的");
    newCard.type = "button";
    newCard.style.whiteSpace = "pre-line";
    newCard.addEventListener("click", openForm);
    refs.recent.appendChild(newCard);
  }

  /* ---------- 菜谱本 ---------- */

  function filteredRecipes() {
    var base = state.query ? VS.searchRecipes(state.query) : VS.recipes.slice();
    if (state.recipeFilter !== "all") {
      base = base.filter(function (recipe) {
        return recipe.tags.indexOf(state.recipeFilter) !== -1;
      });
    }
    return base;
  }

  function renderRecipeFilters() {
    clear(refs.filters);
    var options = [{ id: "all", name: "全部" }].concat(
      VS.slots.map(function (slot) {
        return { id: slot.id, name: slot.name };
      })
    );

    options.forEach(function (option) {
      var chip = el("button", "vs-chip", option.name);
      chip.type = "button";
      chip.setAttribute("aria-pressed", state.recipeFilter === option.id ? "true" : "false");
      chip.addEventListener("click", function () {
        state.recipeFilter = option.id;
        renderRecipeView();
      });
      refs.filters.appendChild(chip);
    });
  }

  function renderRecipeGrid() {
    clear(refs.grid);
    var recipes = filteredRecipes();

    if (!recipes.length) {
      var empty = el("div", "vs-empty", "没有找到这道菜。");
      empty.appendChild(el("small", null, "换个词，或者点右上角写一道新的。"));
      empty.style.gridColumn = "1 / -1";
      refs.grid.appendChild(empty);
      return;
    }

    recipes.forEach(function (recipe) {
      var card = el("button", "a-card");
      card.type = "button";
      card.setAttribute("aria-label", "查看 " + recipe.name);

      var tape = el("span", "vs-tape a-card__tape");
      tape.setAttribute("aria-hidden", "true");
      card.appendChild(tape);

      card.appendChild(VS.ui.art(recipe, "a-card__art"));

      if (recipe.tags.length) {
        var label = VS.slotName(recipe.tags[0]);
        if (recipe.tags.length > 1) label += " +" + (recipe.tags.length - 1);
        card.appendChild(el("span", "a-card__tag", label));
      }

      card.appendChild(el("span", "a-card__name", recipe.name));
      card.appendChild(el("span", "a-card__meta", VS.ui.metaText(recipe)));

      card.addEventListener("click", function () {
        openRecipe(recipe);
      });
      refs.grid.appendChild(card);
    });
  }

  function renderRecipeView() {
    refs.recipeCount.textContent = "一共 " + VS.recipes.length + " 道";
    if (document.activeElement !== refs.search) {
      refs.search.value = state.query;
    }
    renderRecipeFilters();
    renderRecipeGrid();
  }

  /* ---------- 转盘 ---------- */

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

  function updateWheelCand(poolSize) {
    clear(refs.wheelCand);
    if (!state.wheelItems.length) {
      refs.wheelCand.appendChild(
        document.createTextNode("这一组暂时没有菜，换个时段，或者关掉「避开今天」看看。")
      );
      return;
    }
    var names = state.wheelItems
      .map(function (recipe) {
        return recipe.name;
      })
      .join("、");
    var text = "本轮候选 " + state.wheelItems.length + " 道：" + names;
    if (poolSize > state.wheelItems.length) {
      text += "（从 " + poolSize + " 道里挑了 " + state.wheelItems.length + " 道）";
    }
    refs.wheelCand.appendChild(document.createTextNode(text));
  }

  function ensureWheel(force) {
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
      state.wheel = VS.createWheel(refs.wheel, {
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

  function renderWheelFilters() {
    clear(refs.wheelFilters);
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
        ensureWheel(true);
        renderWheelFilters();
      });
      refs.wheelFilters.appendChild(chip);
    });
  }

  function renderWheelView() {
    refs.avoid.checked = state.avoidToday;
    renderWheelFilters();
    ensureWheel(false);

    var note = document.querySelector(".a-wheelnote");
    if (note) {
      note.textContent = VS.isPast(state.selected)
        ? "过去的日子只能翻看。转盘可以玩玩，但不能再加点。"
        : "转到哪道，就把它放进这一天的一餐。点轮心那个「转」字。";
    }
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

  /* ---------- 日历 ---------- */

  function renderCalendarView() {
    VS.ui.calendar(refs.calendar, {
      month: state.calMonth,
      selected: state.selected,
      onMonthChange: function (month) {
        state.calMonth = month;
        renderAll();
      },
      onSelect: function (key) {
        state.selected = key;
        state.calMonth = startOfMonth(VS.parseDate(key));
        renderAll();
      },
      onToday: function () {
        state.selected = VS.todayKey();
        state.calMonth = startOfMonth(new Date());
        renderAll();
      }
    });

    renderDayPanel();
  }

  function renderDayPanel() {
    clear(refs.day);
    var plan = VS.planFor(state.selected);
    var count = VS.dayDishCount(state.selected);
    var past = VS.isPast(state.selected);
    var future = VS.isFuture(state.selected);

    var head = el("div", "a-day__head");
    var headMain = el("div");
    headMain.appendChild(el("h3", "a-day__title", VS.dayTitle(state.selected)));
    var subParts = [];
    if (future) subParts.push("提前备菜");
    if (past) subParts.push("只读");
    subParts.push(count ? "已点 " + count + " 道" : "还没开火");
    headMain.appendChild(el("p", "a-day__sub", subParts.join(" · ")));

    var actions = el("div", "a-day__actions");
    if (!past) {
      var addDay = el("button", "vs-link vs-link--seal", "＋ 点一道");
      addDay.type = "button";
      addDay.addEventListener("click", function () {
        openSlotSheet();
      });
      actions.appendChild(addDay);
    }
    if (count) {
      var copy = el("button", "vs-link", "复制本日");
      copy.type = "button";
      copy.addEventListener("click", function () {
        VS.ui.copySheet({ fromKey: state.selected });
      });
      actions.appendChild(copy);
    }

    appendChildren(head, [headMain, actions]);
    refs.day.appendChild(head);

    VS.slots.forEach(function (slot) {
      var ids = (plan[slot.id] || []).slice();
      var row = el("div", "a-mealrow");
      row.appendChild(el("span", "a-mealrow__glyph", slot.glyph));

      var main = el("div", "a-mealrow__main");
      var name = el("div", "a-mealrow__name");
      name.appendChild(document.createTextNode(slot.name));
      main.appendChild(name);
      main.appendChild(el("div", "a-mealrow__meta", VS.slotRangeText(slot)));

      if (ids.length) {
        var dishes = el("div", "a-mealrow__dishes");
        ids.forEach(function (id) {
          var recipe = VS.getRecipe(id);
          if (!recipe) return;
          var dish = el("button", "a-mealrow__dish");
          dish.type = "button";
          dish.setAttribute("aria-label", "查看 " + recipe.name);
          dish.appendChild(el("em", null, recipe.emoji || "🍲"));
          dish.appendChild(el("span", null, recipe.name));
          dish.addEventListener("click", function () {
            openRecipe(recipe);
          });
          dishes.appendChild(dish);
        });
        main.appendChild(dishes);
      } else {
        main.appendChild(el("div", "a-mealrow__empty", "还空着"));
      }
      row.appendChild(main);

      if (!past) {
        var add = el("button", "a-mealrow__add", "+");
        add.type = "button";
        add.setAttribute("aria-label", "给" + slot.name + "点菜");
        add.addEventListener("click", function () {
          openPicker(slot.id);
        });
        row.appendChild(add);
      } else {
        row.appendChild(el("span"));
      }

      refs.day.appendChild(row);
    });

    if (past) {
      refs.day.appendChild(
        el("p", "a-day__note", "这天已经过去了，只能翻看。想复刻的话，用上方的「复制本日」抄到今天之后。")
      );
    } else if (!count) {
      refs.day.appendChild(
        el("p", "a-day__empty", "这天还没开火。点一道，替这天留下一个红点。")
      );
    }
  }

  function appendChildren(parent, list) {
    list.forEach(function (child) {
      if (child) parent.appendChild(child);
    });
  }

  /* ---------- 点菜流程 ---------- */

  function orderFlow(recipe) {
    if (VS.isPast(state.selected)) {
      VS.ui.toast("过去的日子只能翻看。");
      return;
    }
    openSlotSheet(recipe);
  }

  function openSlotSheet(selectedRecipe) {
    if (VS.isPast(state.selected)) {
      VS.ui.toast("过去的日子只能翻看。");
      return;
    }
    var preselect = VS.isToday(state.selected) ? VS.currentSlot() : null;
    VS.ui.slotSheet({
      dateKey: state.selected,
      preselect: preselect,
      onPick: function (slotId) {
        if (selectedRecipe) {
          var added = VS.addDish(state.selected, slotId, selectedRecipe.id);
          if (added) {
            VS.ui.toast(
              "已放进 " + VS.dayTitle(state.selected) + " · " + VS.slotName(slotId),
              {
                undo: function () {
                  VS.removeDish(state.selected, slotId, selectedRecipe.id);
                }
              }
            );
          } else {
            VS.ui.toast("这道已经在" + VS.slotName(slotId) + "里了。");
          }
          return;
        }
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
      onDone: renderAll
    });
  }

  function openRecipe(recipe) {
    VS.ui.recipeDetail(recipe, {
      onOrder: orderFlow
    });
  }

  function openForm() {
    VS.ui.recipeForm();
  }

  /* ---------- 视图切换 ---------- */

  function setView(view) {
    state.view = view;
    renderAll();
    window.scrollTo(0, 0);
  }

  function updateTabs() {
    var tabs = document.querySelectorAll(".a-tab");
    Array.prototype.forEach.call(tabs, function (tab) {
      var active = tab.dataset.tab === state.view;
      tab.classList.toggle("is-active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });

    var views = document.querySelectorAll(".a-view");
    Array.prototype.forEach.call(views, function (view) {
      view.classList.toggle("is-active", view.dataset.view === state.view);
    });
  }

  /* ---------- 总渲染 ---------- */

  function renderAll() {
    renderHeader();
    renderDateStrip();
    renderBanner();
    renderSlips();
    renderSummary();
    renderRecent();
    renderRecipeView();
    renderWheelView();
    renderCalendarView();
    updateTabs();
  }

  /* ---------- 事件绑定 ---------- */

  Array.prototype.forEach.call(document.querySelectorAll(".a-tab"), function (tab) {
    tab.addEventListener("click", function () {
      setView(tab.dataset.tab);
    });
  });

  $("a-see-recipes").addEventListener("click", function () {
    setView("recipes");
  });

  $("a-write").addEventListener("click", openForm);

  refs.search.addEventListener("input", function () {
    state.query = refs.search.value;
    renderRecipeGrid();
  });

  refs.avoid.addEventListener("change", function () {
    state.avoidToday = refs.avoid.checked;
    ensureWheel(true);
  });

  VS.onChange = renderAll;

  renderAll();
  state.entrance = false;
})();
