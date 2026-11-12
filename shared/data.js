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

  /* ---------- 示例菜谱 ---------- */

  VS.recipes = [
    {
      id: "r1",
      name: "皮蛋瘦肉粥",
      emoji: "🥣",
      tint: "#e6d3ae",
      minutes: 35,
      tags: ["breakfast", "latenight"],
      note: "前一晚把米泡上，早上能多睡十分钟。",
      ingredients: [
        { name: "大米", amount: "80g" },
        { name: "皮蛋", amount: "1 个" },
        { name: "猪里脊", amount: "100g" },
        { name: "姜丝", amount: "少许" },
        { name: "葱花", amount: "少许" }
      ],
      steps: [
        "大米淘洗后浸泡 20 分钟。",
        "里脊切细丝，用一点盐和淀粉抓匀。",
        "水开下米，中小火煮 20 分钟，期间搅两次底。",
        "下皮蛋块和肉丝，再煮 5 分钟。",
        "调盐和白胡椒，撒葱花出锅。"
      ]
    },
    {
      id: "r2",
      name: "葱油拌面",
      emoji: "🍜",
      tint: "#e8c79c",
      minutes: 15,
      tags: ["breakfast", "lunch", "latenight"],
      note: "葱要慢慢炸，急不得。",
      ingredients: [
        { name: "细面", amount: "150g" },
        { name: "小葱", amount: "6 根" },
        { name: "生抽", amount: "2 勺" },
        { name: "老抽", amount: "半勺" },
        { name: "糖", amount: "1 小勺" }
      ],
      steps: [
        "小葱切段，冷油下锅。",
        "小火炸到葱段焦黄，捞出备用。",
        "酱油和糖倒进葱油，小火煮开。",
        "面条煮熟沥干。",
        "淋葱油拌匀，撒上葱酥。"
      ]
    },
    {
      id: "r3",
      name: "番茄炒蛋",
      emoji: "🍅",
      tint: "#e7b49c",
      minutes: 12,
      tags: ["lunch", "dinner"],
      note: "番茄要炒到出沙，汤汁才拌得开饭。",
      ingredients: [
        { name: "番茄", amount: "2 个" },
        { name: "鸡蛋", amount: "3 个" },
        { name: "盐", amount: "适量" },
        { name: "糖", amount: "半勺" },
        { name: "葱花", amount: "少许" }
      ],
      steps: [
        "番茄切块，鸡蛋打散加少许盐。",
        "热油炒蛋，凝固即盛出。",
        "番茄下锅炒出汁。",
        "倒回鸡蛋翻匀，调盐和糖。",
        "撒葱花，关火。"
      ]
    },
    {
      id: "r4",
      name: "蒜蓉西兰花",
      emoji: "🥦",
      tint: "#c9d2ac",
      minutes: 10,
      tags: ["lunch", "dinner"],
      note: "焯水时加一点盐和油，颜色更绿。",
      ingredients: [
        { name: "西兰花", amount: "1 颗" },
        { name: "蒜", amount: "4 瓣" },
        { name: "盐", amount: "适量" },
        { name: "蚝油", amount: "1 勺" }
      ],
      steps: [
        "西兰花掰小朵，盐水泡 10 分钟。",
        "水开焯 1 分钟，捞出沥干。",
        "蒜末爆香。",
        "下西兰花大火翻炒。",
        "用蚝油和盐调味。"
      ]
    },
    {
      id: "r5",
      name: "红烧肉",
      emoji: "🍖",
      tint: "#d8af8a",
      minutes: 90,
      tags: ["lunch", "dinner"],
      note: "收汁的时候别走开。",
      ingredients: [
        { name: "五花肉", amount: "500g" },
        { name: "冰糖", amount: "20g" },
        { name: "生抽", amount: "2 勺" },
        { name: "老抽", amount: "1 勺" },
        { name: "八角", amount: "1 颗" },
        { name: "姜", amount: "3 片" }
      ],
      steps: [
        "五花肉切块，冷水下锅焯水。",
        "小火炒糖色。",
        "下肉块裹上糖色。",
        "加姜、八角、酱油和热水，小火炖 60 分钟。",
        "开大火收汁，留一点拌饭。"
      ]
    },
    {
      id: "r6",
      name: "清蒸鲈鱼",
      emoji: "🐟",
      tint: "#c4d5d0",
      minutes: 25,
      tags: ["dinner"],
      note: "水开后再上锅，八分钟就够。",
      ingredients: [
        { name: "鲈鱼", amount: "1 条" },
        { name: "姜", amount: "4 片" },
        { name: "葱", amount: "2 根" },
        { name: "蒸鱼豉油", amount: "2 勺" },
        { name: "热油", amount: "1 勺" }
      ],
      steps: [
        "鱼处理干净，两面划刀。",
        "铺姜片，水开上锅蒸 8 分钟。",
        "倒掉盘里的水。",
        "铺葱丝，淋蒸鱼豉油。",
        "浇一勺热油，上桌。"
      ]
    },
    {
      id: "r7",
      name: "空气炸锅鸡翅",
      emoji: "🍗",
      tint: "#e2bc8d",
      minutes: 20,
      tags: ["lunch", "dinner", "latenight"],
      note: "腌一夜更入味，第二天回家直接烤。",
      ingredients: [
        { name: "鸡翅中", amount: "8 个" },
        { name: "生抽", amount: "2 勺" },
        { name: "蜂蜜", amount: "1 勺" },
        { name: "蒜粉", amount: "半勺" },
        { name: "黑胡椒", amount: "少许" }
      ],
      steps: [
        "鸡翅两面划刀。",
        "加调料腌 30 分钟。",
        "180 度烤 12 分钟。",
        "翻面刷蜂蜜，再烤 5 分钟。"
      ]
    },
    {
      id: "r8",
      name: "桂花酒酿小圆子",
      emoji: "🍡",
      tint: "#ead3b6",
      minutes: 15,
      tags: ["teatime", "latenight"],
      note: "酒酿最后放，别久煮。",
      ingredients: [
        { name: "酒酿", amount: "200g" },
        { name: "小圆子", amount: "100g" },
        { name: "干桂花", amount: "少许" },
        { name: "枸杞", amount: "10 粒" },
        { name: "冰糖", amount: "适量" }
      ],
      steps: [
        "水开下小圆子，煮到浮起。",
        "加酒酿和冰糖。",
        "再次煮开，撒枸杞。",
        "关火，撒干桂花。"
      ]
    },
    {
      id: "r9",
      name: "提拉米苏",
      emoji: "🍰",
      tint: "#dac2a8",
      minutes: 40,
      tags: ["teatime"],
      note: "冷藏过夜更好切。",
      ingredients: [
        { name: "马斯卡彭", amount: "250g" },
        { name: "手指饼干", amount: "1 包" },
        { name: "浓缩咖啡", amount: "100ml" },
        { name: "蛋黄", amount: "2 个" },
        { name: "糖", amount: "40g" },
        { name: "可可粉", amount: "适量" }
      ],
      steps: [
        "蛋黄加糖隔水打发。",
        "拌入马斯卡彭。",
        "手指饼干蘸咖啡，铺一层。",
        "交替铺奶酪糊和饼干。",
        "冷藏 4 小时，筛可可粉。"
      ]
    },
    {
      id: "r10",
      name: "韩式辣炒年糕",
      emoji: "🌶️",
      tint: "#e0a18e",
      minutes: 18,
      tags: ["teatime", "latenight"],
      note: "年糕别煮太久，会软。",
      ingredients: [
        { name: "年糕条", amount: "250g" },
        { name: "鱼饼", amount: "100g" },
        { name: "韩式辣酱", amount: "2 勺" },
        { name: "洋葱", amount: "半个" },
        { name: "芝士", amount: "1 片" }
      ],
      steps: [
        "年糕泡水 10 分钟。",
        "洋葱炒香。",
        "加水和辣酱煮开。",
        "下年糕和鱼饼煮 5 分钟。",
        "放芝士，盖盖焖化。"
      ]
    },
    {
      id: "r11",
      name: "香煎小笼包",
      emoji: "🥟",
      tint: "#e4c9a2",
      minutes: 15,
      tags: ["breakfast", "lunch"],
      note: "面粉水就是面粉加清水，薄薄一层就够。",
      ingredients: [
        { name: "速冻小笼包", amount: "10 个" },
        { name: "面粉水", amount: "半碗" },
        { name: "黑芝麻", amount: "少许" },
        { name: "葱花", amount: "少许" }
      ],
      steps: [
        "平底锅刷油，摆入小笼包。",
        "煎到底部微黄。",
        "倒入面粉水，盖盖。",
        "中火焖 8 分钟。",
        "撒芝麻葱花，收干水汽。"
      ]
    },
    {
      id: "r12",
      name: "牛油果吐司",
      emoji: "🥑",
      tint: "#cbd2a0",
      minutes: 10,
      tags: ["breakfast", "teatime"],
      note: "牛油果要熟透，压起来才顺。",
      ingredients: [
        { name: "吐司", amount: "2 片" },
        { name: "牛油果", amount: "1 个" },
        { name: "鸡蛋", amount: "1 个" },
        { name: "黑胡椒", amount: "少许" },
        { name: "柠檬汁", amount: "几滴" }
      ],
      steps: [
        "吐司烤到边缘微脆。",
        "牛油果压泥，加柠檬汁。",
        "水波蛋煮 3 分钟。",
        "吐司涂牛油果泥，放上蛋。",
        "撒盐和黑胡椒。"
      ]
    }
  ];

  /* ---------- 计划（相对今天生成） ---------- */

  VS.plans = {};

  var today = new Date();
  function dayKey(n) {
    return VS.dateKey(VS.addDays(today, n));
  }

  VS.plans[dayKey(0)] = {
    breakfast: ["r12"],
    lunch: ["r3", "r4"],
    teatime: ["r8"],
    dinner: ["r5", "r6"]
  };
  VS.plans[dayKey(1)] = { breakfast: ["r1"], dinner: ["r7"] };
  VS.plans[dayKey(2)] = { teatime: ["r9"] };
  VS.plans[dayKey(3)] = { breakfast: ["r12"], lunch: ["r2"] };
  VS.plans[dayKey(-1)] = { dinner: ["r3", "r7"] };
  VS.plans[dayKey(-2)] = { breakfast: ["r11"], teatime: ["r8"] };
  VS.plans[dayKey(-4)] = { lunch: ["r2"], dinner: ["r5"] };
  VS.plans[dayKey(-6)] = { dinner: ["r5"] };
  VS.plans[dayKey(-9)] = { breakfast: ["r1"], dinner: ["r6"] };

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
