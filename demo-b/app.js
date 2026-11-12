/* ============================================================
   Demo B · 手帐食谱本
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

  var state = {
    selected: VS.todayKey(),
    calMonth: startOfMonth(new Date()),
    recipeFilter: "all",
    query: "",
    wheelFilter: VS.currentSlot(),
    avoidToday: false,
    wheel: null,
    wheelSig: "",
    wheelItems: [],
    wheelPoolSize: 0
  };

  var refs = {
    rel: $("b-rel"),
    day: $("b-day"),
    month: $("b-month"),
    weekday: $("b-weekday"),
    dates: $("b-dates"),
    banner: $("b-banner"),
    planTitle: $("b-plan-title"),
    planNote: $("b-plan-note"),
    menu: $("b-menu"),
    planfoot: $("b-planfoot"),
    wheelFilters: $("b-wheel-filters"),
    avoid: $("b-avoid"),
    wheel: $("b-wheel-canvas"),
    wheelCand: $("b-wheel-cand"),
    search: $("b-search"),
    filters: $("b-filters"),
    grid: $("b-grid"),
    calendar: $("b-calendar"),
    daypanel: $("b-daypanel")
  };

  /* ---------- 封面 ---------- */

  function renderCover() {
    var date = VS.parseDate(state.selected);
    refs.day.textContent = String(date.getDate());
    refs.month.textContent = date.getMonth() + 1 + "月";
    refs.weekday.textContent = "星期" + VS.weekdayCN(date);
    refs.rel.textContent =
      VS.relativeLabel(state.selected) || (VS.isFuture(state.selected) ? "备菜" : "旧页");

    VS.ui.dateStrip(refs.dates, {
      selected: state.selected,
      onChange: function (key) {
        state.selected = key;
        state.calMonth = startOfMonth(VS.parseDate(key));
        renderAll();
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

    clear(refs.banner);
    refs.banner.className = "b-banner";
    if (VS.isPast(state.selected)) {
      refs.banner.classList.add("is-past");
      refs.banner.appendChild(el("span", "b-banner__mark", "只读"));
      refs.banner.appendChild(
        el("p", null, "这页已经翻过去了，只能看。想复刻，就抄到今天之后。")
      );
    } else if (VS.isFuture(state.selected)) {
      refs.banner.appendChild(el("span", "b-banner__mark", "提前备菜"));
      refs.banner.appendChild(
        el("p", null, "正在为 " + VS.dayTitle(state.selected) + " 备菜，点菜时会先问放进哪一餐。")
      );
    } else {
      refs.banner.classList.add("is-hidden");
    }
  }

  /* ---------- 餐单 ---------- */

  function renderMenu() {
    clear(refs.menu);
    var plan = VS.planFor(state.selected);
    var past = VS.isPast(state.selected);
    var today = VS.isToday(state.selected);
    var current = VS.currentSlot();

    refs.planTitle.textContent = today ? "今日餐单" : VS.isFuture(state.selected) ? "备菜餐单" : "旧页餐单";
    refs.planNote.textContent = past
      ? "这页只能翻看"
      : VS.isFuture(state.selected)
      ? "提前备菜，先选餐次"
      : "想吃哪一餐就点哪一行";

    VS.slots.forEach(function (slot) {
      var ids = (plan[slot.id] || []).slice();
      var row = el("div", "b-meal");
      if (ids.length) row.classList.add("is-done");
      if (today && current === slot.id) row.classList.add("is-now");

      row.appendChild(el("span", "b-check", ids.length ? "✓" : ""));

      var main = el("div", "b-meal__main");
      var name = el("div", "b-meal__slot");
      name.appendChild(document.createTextNode(slot.name));
      name.appendChild(el("span", "b-meal__time", VS.slotRangeText(slot)));
      if (today && current === slot.id) name.appendChild(el("span", "b-now", "现在"));
      main.appendChild(name);

      if (ids.length) {
        var dishes = el("div", "b-meal__dishes");
        ids.forEach(function (id) {
          var recipe = VS.getRecipe(id);
          if (!recipe) return;
          var dish = el("button", "b-meal__dish");
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
        main.appendChild(el("div", "b-meal__empty", "还空着，点右边那道 +。"));
      }
      row.appendChild(main);

      if (past) {
        row.appendChild(el("span", "b-meal__add-placeholder"));
      } else {
        var add = el("button", "b-meal__add", "+");
        add.type = "button";
        add.setAttribute("aria-label", "给" + slot.name + "点菜");
        add.addEventListener("click", function () {
          openPicker(slot.id);
        });
        row.appendChild(add);
      }

      refs.menu.appendChild(row);
    });

    renderPlanFoot();
  }

  function renderPlanFoot() {
    clear(refs.planfoot);
    var count = VS.dayDishCount(state.selected);
    var past = VS.isPast(state.selected);

    var note = el("span", "b-planfoot__note");
    note.appendChild(el("strong", null, dayLabel(state.selected)));
    note.appendChild(document.createTextNode(count ? " · 已点 " + count + " 道" : " · 还没开火"));
    refs.planfoot.appendChild(note);

    if (!past) {
      var add = el("button", "vs-link vs-link--seal", "＋ 点一道");
      add.type = "button";
      add.addEventListener("click", function () {
        openSlotSheet(null);
      });
      refs.planfoot.appendChild(add);
    }

    if (count) {
      var copy = el("button", "vs-link", "复制这页");
      copy.type = "button";
      copy.addEventListener("click", function () {
        VS.ui.copySheet({ fromKey: state.selected });
      });
      refs.planfoot.appendChild(copy);
    }

    var wheelLink = el("button", "vs-link", "去转盘 ›");
    wheelLink.type = "button";
    wheelLink.addEventListener("click", function () {
      scrollToSection("b-wheel");
    });
    refs.planfoot.appendChild(wheelLink);
  }

  function openRecipe(recipe) {
    VS.ui.recipeDetail(recipe, { onOrder: orderFlow });
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
    VS.ui.slotSheet({
      dateKey: state.selected,
      preselect: VS.isToday(state.selected) ? VS.currentSlot() : null,
      onPick: function (slotId) {
        if (selectedRecipe) {
          addOne(selectedRecipe, slotId);
          return;
        }
        openPicker(slotId);
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
    var text = "这一轮 " + state.wheelItems.length + " 道：" + names;
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
      state.wheel = VS.createWheel(refs.wheel, { items: chosen, onResult: handleWheelResult });
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

  function renderWheelSection() {
    refs.avoid.checked = state.avoidToday;
    renderWheelFilters();
    ensureWheel(false);
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

  /* ---------- 菜谱索引 ---------- */

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
        renderRecipes();
      });
      refs.filters.appendChild(chip);
    });
  }

  function renderRecipeGrid() {
    clear(refs.grid);
    var recipes = filteredRecipes();

    if (!recipes.length) {
      var empty = el("div", "vs-empty", "没有找到这道菜。");
      empty.appendChild(el("small", null, "换个词，或者点「写一道」加进来。"));
      empty.style.gridColumn = "1 / -1";
      refs.grid.appendChild(empty);
      return;
    }

    recipes.forEach(function (recipe) {
      var card = el("button", "b-photo");
      card.type = "button";
      card.setAttribute("aria-label", "查看 " + recipe.name);

      var tape = el("span", "vs-tape b-photo__tape");
      tape.setAttribute("aria-hidden", "true");
      card.appendChild(tape);
      card.appendChild(VS.ui.art(recipe));

      var cap = el("span", "b-photo__cap");
      cap.appendChild(el("span", "b-photo__name", recipe.name));
      if (recipe.tags.length) cap.appendChild(el("span", "b-photo__tag", VS.slotName(recipe.tags[0])));
      card.appendChild(cap);
      card.appendChild(el("span", "b-photo__meta", VS.ui.metaText(recipe)));

      card.addEventListener("click", function () {
        openRecipe(recipe);
      });
      refs.grid.appendChild(card);
    });
  }

  function renderRecipes() {
    if (document.activeElement !== refs.search) refs.search.value = state.query;
    renderRecipeFilters();
    renderRecipeGrid();
  }

  /* ---------- 月历 ---------- */

  function renderCalendarSection() {
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
    clear(refs.daypanel);
    var plan = VS.planFor(state.selected);
    var count = VS.dayDishCount(state.selected);
    var past = VS.isPast(state.selected);
    var future = VS.isFuture(state.selected);

    var head = el("div", "b-dayhead");
    var main = el("div");
    main.appendChild(el("h3", null, VS.dayTitle(state.selected)));
    var bits = [];
    if (future) bits.push("提前备菜");
    if (past) bits.push("只读");
    bits.push(count ? "已点 " + count + " 道" : "还没开火");
    main.appendChild(el("p", null, bits.join(" · ")));

    var actions = el("div", "b-dayhead__actions");
    if (!past) {
      var addDay = el("button", "vs-link vs-link--seal", "＋ 点一道");
      addDay.type = "button";
      addDay.addEventListener("click", function () {
        openSlotSheet(null);
      });
      actions.appendChild(addDay);
    }
    if (count) {
      var copy = el("button", "vs-link", "复制这页");
      copy.type = "button";
      copy.addEventListener("click", function () {
        VS.ui.copySheet({ fromKey: state.selected });
      });
      actions.appendChild(copy);
    }

    head.appendChild(main);
    head.appendChild(actions);
    refs.daypanel.appendChild(head);

    VS.slots.forEach(function (slot) {
      var ids = (plan[slot.id] || []).slice();
      var row = el("div", "b-dayrow");
      row.appendChild(el("span", "b-dayrow__glyph", slot.glyph));

      var middle = el("div");
      middle.appendChild(el("div", "b-dayrow__name", slot.name));

      if (ids.length) {
        var dishes = el("div", "b-dayrow__dishes");
        ids.forEach(function (id) {
          var recipe = VS.getRecipe(id);
          if (!recipe) return;
          var dish = el("button", "b-dayrow__dish");
          dish.type = "button";
          dish.setAttribute("aria-label", "查看 " + recipe.name);
          dish.appendChild(el("em", null, recipe.emoji || "🍲"));
          dish.appendChild(el("span", null, recipe.name));
          dish.addEventListener("click", function () {
            openRecipe(recipe);
          });
          dishes.appendChild(dish);
        });
        middle.appendChild(dishes);
      } else {
        middle.appendChild(el("div", "b-dayrow__empty", "还空着"));
      }
      row.appendChild(middle);

      if (!past) {
        var add = el("button", "b-dayrow__add", "+");
        add.type = "button";
        add.setAttribute("aria-label", "给" + slot.name + "点菜");
        add.addEventListener("click", function () {
          openPicker(slot.id);
        });
        row.appendChild(add);
      } else {
        row.appendChild(el("span"));
      }

      refs.daypanel.appendChild(row);
    });

    if (past) {
      refs.daypanel.appendChild(
        el("p", "b-daynote", "这页只能翻看。想再吃一次，就用上方的「复制这页」抄到今天之后。")
      );
    } else if (!count) {
      refs.daypanel.appendChild(
        el("p", "b-dayempty", "这天还没开火。点一道，替这页留下一个红点。")
      );
    }
  }

  /* ---------- 索引坞 ---------- */

  var sectionIds = ["b-today", "b-wheel", "b-recipes", "b-calendar-sec"];
  var dockButtons = document.querySelectorAll(".b-dock__btn");

  function scrollToSection(id) {
    var target = document.getElementById(id);
    if (!target) return;
    var top = target.getBoundingClientRect().top + window.scrollY - 14;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: id === "b-today" ? 0 : top, behavior: reduce ? "auto" : "smooth" });
  }

  function updateDock() {
    var probe = window.scrollY + 170;
    var current = sectionIds[0];
    sectionIds.forEach(function (id) {
      var section = document.getElementById(id);
      if (!section) return;
      var top = section.getBoundingClientRect().top + window.scrollY;
      if (top <= probe) current = id;
    });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 30) {
      current = sectionIds[sectionIds.length - 1];
    }
    Array.prototype.forEach.call(dockButtons, function (btn) {
      var active = btn.dataset.target === current;
      btn.classList.toggle("is-active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
  }

  var ticking = false;
  window.addEventListener(
    "scroll",
    function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        updateDock();
        ticking = false;
      });
    },
    { passive: true }
  );

  Array.prototype.forEach.call(dockButtons, function (btn) {
    btn.addEventListener("click", function () {
      scrollToSection(btn.dataset.target);
    });
  });

  /* ---------- 总渲染 ---------- */

  function renderAll() {
    renderCover();
    renderMenu();
    renderWheelSection();
    renderRecipes();
    renderCalendarSection();
    window.requestAnimationFrame(updateDock);
  }

  refs.search.addEventListener("input", function () {
    state.query = refs.search.value;
    renderRecipeGrid();
  });

  refs.avoid.addEventListener("change", function () {
    state.avoidToday = refs.avoid.checked;
    ensureWheel(true);
  });

  $("b-write").addEventListener("click", function () {
    VS.ui.recipeForm();
  });

  VS.onChange = renderAll;

  /* ---------- 数据备份（导出 / 导入） ---------- */

  function hideBoot() {
    var boot = $("b-boot");
    if (boot) boot.classList.add("is-hidden");
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function backupName() {
    var d = new Date();
    return "火山严选备份-" + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + ".json";
  }

  function downloadFile(name, text) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 4000);
  }

  $("b-export").addEventListener("click", function () {
    if (!VS.store || !VS.store.exportData) {
      VS.ui.toast("当前环境不支持导出。");
      return;
    }
    VS.store
      .exportData()
      .then(function (json) {
        downloadFile(backupName(), json);
        VS.ui.toast("已导出备份文件。");
      })
      .catch(function () {
        VS.ui.toast("导出失败，请重试。");
      });
  });

  $("b-import").addEventListener("click", function () {
    $("b-import-file").click();
  });

  $("b-import-file").addEventListener("change", function () {
    var file = this.files && this.files[0];
    this.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      if (!VS.store || !VS.store.importData) {
        VS.ui.toast("当前环境不支持导入。");
        return;
      }
      VS.store
        .importData(reader.result)
        .then(function () {
          VS.ui.toast("已恢复备份。");
        })
        .catch(function (err) {
          VS.ui.toast((err && err.message) || "导入失败，文件可能损坏。");
        });
    };
    reader.onerror = function () {
      VS.ui.toast("读取文件失败。");
    };
    reader.readAsText(file);
  });

  function renderStorageHint(persisted) {
    var hint = $("b-storage-hint");
    if (!hint) return;
    hint.textContent = persisted
      ? "数据保存在本机浏览器，可离线使用；建议定期「导出备份」。"
      : "当前环境无法持久保存，刷新会回到示例数据。";
  }

  /* ---------- 启动：先 hydrate，再渲染 ---------- */

  function start(showPersist) {
    renderAll();
    updateDock();
    hideBoot();
    if (showPersist && VS.store && VS.store.requestPersist) VS.store.requestPersist();
  }

  var boot = VS.store && VS.store.boot ? VS.store.boot() : Promise.resolve({ persisted: false });
  boot
    .then(function (res) {
      start(true);
      renderStorageHint(res && res.persisted);
    })
    .catch(function (err) {
      if (window.console) console.error(err);
      start(false);
      renderStorageHint(false);
    });
})();
