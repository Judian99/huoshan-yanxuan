/* ============================================================
   火山严选 · 示例数据与内存操作
   静态原型：刷新即重置，不写 localStorage
   ============================================================ */

(function () {
  "use strict";

  var VS = (window.VS = window.VS || {});

  /* ---------- 基础日期工具 ---------- */

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  VS.dateKey = function (date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  };

  VS.parseDate = function (key) {
    var parts = key.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  };

  VS.addDays = function (date, n) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    d.setDate(d.getDate() + n);
    return d;
  };

  VS.todayKey = function () {
    return VS.dateKey(new Date());
  };

  VS.dayDiff = function (aKey, bKey) {
    var a = VS.parseDate(aKey);
    var b = VS.parseDate(bKey);
    return Math.round((a - b) / 86400000);
  };

  VS.isToday = function (key) {
    return key === VS.todayKey();
  };

  VS.isPast = function (key) {
    return VS.dayDiff(key, VS.todayKey()) < 0;
  };

  VS.isFuture = function (key) {
    return VS.dayDiff(key, VS.todayKey()) > 0;
  };

  VS.weekdayCN = function (date) {
    return "日一二三四五六".charAt(date.getDay());
  };

  VS.monthDay = function (date) {
    return date.getMonth() + 1 + "月" + date.getDate() + "日";
  };

  VS.shortDate = function (date) {
    return date.getMonth() + 1 + "." + pad(date.getDate());
  };

  VS.relativeLabel = function (key) {
    var diff = VS.dayDiff(key, VS.todayKey());
    if (diff === 0) return "今天";
    if (diff === 1) return "明天";
    if (diff === 2) return "后天";
    if (diff === -1) return "昨天";
    if (diff === -2) return "前天";
    return "";
  };

  VS.dayTitle = function (key) {
    var date = VS.parseDate(key);
    var rel = VS.relativeLabel(key);
    return (
      VS.monthDay(date) +
      " 周" +
      VS.weekdayCN(date) +
      (rel && rel !== "今天" ? " · " + rel : "")
    );
  };

  /* ---------- 五个时段 ---------- */

  VS.slots = [
    { id: "breakfast", name: "早餐", short: "早", glyph: "早", range: [300, 570] },
    { id: "lunch", name: "午餐", short: "午", glyph: "午", range: [570, 840] },
    { id: "teatime", name: "下午茶", short: "茶", glyph: "茶", range: [840, 1020] },
    { id: "dinner", name: "晚餐", short: "晚", glyph: "晚", range: [1020, 1260] },
    { id: "latenight", name: "夜宵", short: "夜", glyph: "夜", range: [1260, 1740] }
  ];

  VS.slotMap = {};
  VS.slots.forEach(function (slot) {
    VS.slotMap[slot.id] = slot;
  });

  VS.slotName = function (id) {
    return VS.slotMap[id] ? VS.slotMap[id].name : id;
  };

  VS.currentSlot = function (now) {
    var d = now || new Date();
    var minutes = d.getHours() * 60 + d.getMinutes();
    if (minutes >= 1260 || minutes < 300) return "latenight";
    for (var i = 0; i < VS.slots.length; i++) {
      var slot = VS.slots[i];
      if (minutes >= slot.range[0] && minutes < slot.range[1]) return slot.id;
    }
    return "lunch";
  };

  VS.slotRangeText = function (slot) {
    if (slot.id === "latenight") return "21:00–05:00";
    var toHM = function (m) {
      return pad(Math.floor(m / 60)) + ":" + pad(m % 60);
    };
    return toHM(slot.range[0]) + "–" + toHM(slot.range[1]);
  };

  /* ---------- 菜谱（初始为空，由用户自己写；数据持久化在浏览器本地） ---------- */

  VS.recipes = [];

  /* ---------- 计划（初始为空，按日期键存储） ---------- */

  VS.plans = {};

  /* ---------- 计划读写 ---------- */

  VS.planFor = function (key) {
    return VS.plans[key] || {};
  };

  VS.ensurePlan = function (key) {
    if (!VS.plans[key]) VS.plans[key] = {};
    return VS.plans[key];
  };

  VS.dayDishCount = function (key) {
    var plan = VS.plans[key];
    if (!plan) return 0;
    return VS.slots.reduce(function (sum, slot) {
      return sum + (plan[slot.id] ? plan[slot.id].length : 0);
    }, 0);
  };

  VS.slotCount = function (key, slotId) {
    var plan = VS.plans[key];
    return plan && plan[slotId] ? plan[slotId].length : 0;
  };

  VS.hasPlan = function (key) {
    return VS.dayDishCount(key) > 0;
  };

  VS.getRecipe = function (id) {
    for (var i = 0; i < VS.recipes.length; i++) {
      if (VS.recipes[i].id === id) return VS.recipes[i];
    }
    return null;
  };

  VS.recipesFor = function (slotId) {
    if (!slotId) return VS.recipes.slice();
    return VS.recipes.filter(function (r) {
      return r.tags.indexOf(slotId) !== -1;
    });
  };

  VS.searchRecipes = function (query) {
    var q = String(query || "").trim().toLowerCase();
    if (!q) return VS.recipes.slice();
    return VS.recipes.filter(function (r) {
      if (r.name.toLowerCase().indexOf(q) !== -1) return true;
      return (r.ingredients || []).some(function (ing) {
        return ing.name.toLowerCase().indexOf(q) !== -1;
      });
    });
  };

  VS.addDish = function (dateKey, slotId, recipeId) {
    if (VS.isPast(dateKey)) return false;
    var plan = VS.ensurePlan(dateKey);
    if (!plan[slotId]) plan[slotId] = [];
    if (plan[slotId].indexOf(recipeId) === -1) {
      plan[slotId].push(recipeId);
      VS.emitChange();
      return true;
    }
    return false;
  };

  VS.removeDish = function (dateKey, slotId, recipeId) {
    var plan = VS.plans[dateKey];
    if (!plan || !plan[slotId]) return false;
    var idx = plan[slotId].indexOf(recipeId);
    if (idx === -1) return false;
    plan[slotId].splice(idx, 1);
    VS.emitChange();
    return true;
  };

  VS.setSlot = function (dateKey, slotId, ids) {
    var plan = VS.ensurePlan(dateKey);
    plan[slotId] = ids.slice();
    VS.emitChange();
  };

  VS.snapshotPlan = function (key) {
    if (!VS.plans[key]) return null;
    var copy = {};
    VS.slots.forEach(function (slot) {
      if (VS.plans[key][slot.id]) copy[slot.id] = VS.plans[key][slot.id].slice();
    });
    return copy;
  };

  VS.restorePlan = function (key, snapshot) {
    if (snapshot === null) {
      delete VS.plans[key];
    } else {
      VS.plans[key] = snapshot;
    }
    VS.emitChange();
  };

  VS.copyPlan = function (fromKey, toKey, slotIds) {
    var source = VS.planFor(fromKey);
    var added = [];
    slotIds.forEach(function (slotId) {
      (source[slotId] || []).forEach(function (id) {
        var plan = VS.ensurePlan(toKey);
        if (!plan[slotId]) plan[slotId] = [];
        if (plan[slotId].indexOf(id) === -1) {
          plan[slotId].push(id);
          added.push({ slot: slotId, id: id });
        }
      });
    });
    VS.emitChange();
    return added;
  };

  /* ---------- 菜谱新增 ---------- */

  VS.addRecipe = function (recipe) {
    VS.recipes.unshift(recipe);
    VS.emitChange();
    return recipe;
  };

  VS.newRecipeId = function () {
    return "r-user-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  };

  // 按 id 更新菜谱（保留其在列表中的位置）；找不到则退回新增
  VS.updateRecipe = function (recipe) {
    var idx = VS.recipes.findIndex(function (r) {
      return r.id === recipe.id;
    });
    if (idx === -1) {
      VS.addRecipe(recipe);
      return recipe;
    }
    VS.recipes[idx] = recipe;
    VS.emitChange();
    return recipe;
  };

  // 删除菜谱，同时从所有餐单中摘除引用；返回撤销所需的快照
  VS.deleteRecipe = function (id) {
    var idx = VS.recipes.findIndex(function (r) {
      return r.id === id;
    });
    if (idx === -1) return null;
    var recipe = VS.recipes[idx];
    var refs = [];
    Object.keys(VS.plans).forEach(function (key) {
      var plan = VS.plans[key];
      VS.slots.forEach(function (slot) {
        var arr = plan[slot.id];
        if (!arr) return;
        var at = arr.indexOf(id);
        while (at !== -1) {
          refs.push({ day: key, slot: slot.id, index: at });
          arr.splice(at, 1);
          at = arr.indexOf(id);
        }
      });
    });
    VS.recipes.splice(idx, 1);
    VS.emitChange();
    return { recipe: recipe, index: idx, refs: refs };
  };

  // 撤销删除：把菜谱和餐单引用恢复到原位
  VS.restoreRecipe = function (snapshot) {
    if (!snapshot || !snapshot.recipe) return;
    var idx = VS.recipes.findIndex(function (r) {
      return r.id === snapshot.recipe.id;
    });
    if (idx === -1) {
      var at = Math.min(snapshot.index || 0, VS.recipes.length);
      VS.recipes.splice(at, 0, snapshot.recipe);
    }
    (snapshot.refs || []).forEach(function (ref) {
      var plan = VS.ensurePlan(ref.day);
      if (!plan[ref.slot]) plan[ref.slot] = [];
      var arr = plan[ref.slot];
      if (arr.indexOf(snapshot.recipe.id) === -1) {
        var pos = Math.min(ref.index, arr.length);
        arr.splice(pos, 0, snapshot.recipe.id);
      }
    });
    VS.emitChange();
  };

  /* ---------- 最近点过 ---------- */

  VS.recentRecipes = function (limit) {
    var keys = Object.keys(VS.plans)
      .filter(function (key) {
        return VS.dayDiff(key, VS.todayKey()) <= 0;
      })
      .sort()
      .reverse();
    var seen = {};
    var result = [];
    keys.forEach(function (key) {
      VS.slots.forEach(function (slot) {
        (VS.plans[key][slot.id] || []).forEach(function (id) {
          if (seen[id]) return;
          var recipe = VS.getRecipe(id);
          if (!recipe) return;
          seen[id] = true;
          result.push(recipe);
        });
      });
    });
    result = result.slice(0, limit || 4);
    if (result.length < (limit || 4)) {
      VS.recipes.forEach(function (recipe) {
        if (result.length >= (limit || 4)) return;
        if (!seen[recipe.id]) {
          seen[recipe.id] = true;
          result.push(recipe);
        }
      });
    }
    return result;
  };

  /* ---------- 变更通知 ---------- */

  VS.onChange = null;
  VS.emitChange = function () {
    if (typeof VS.onChange === "function") VS.onChange();
    if (VS.store && typeof VS.store.schedulePersist === "function") {
      VS.store.schedulePersist();
    }
  };
})();
