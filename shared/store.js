/* ============================================================
   火山严选 · 本地持久化存储（IndexedDB）
   菜谱 / 餐单 / 图片 的读写真穿 + 图片压缩 + 导出导入 + 持久化请求
   ============================================================ */

(function () {
  "use strict";

  var VS = (window.VS = window.VS || {});
  var store = (VS.store = VS.store || {});

  var DB_NAME = "vs-notebook";
  var DB_VERSION = 1;
  var STORE_RECIPES = "recipes";
  var STORE_PLANS = "plans";
  var STORE_IMAGES = "images";

  var dbPromise = null;
  var persistTimer = null;
  var objectURLs = [];
  var available = typeof window.indexedDB !== "undefined";

  /* ---------- IndexedDB 基础 ---------- */

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!available) {
        reject(new Error("IndexedDB 不可用"));
        return;
      }
      var req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_RECIPES)) {
          db.createObjectStore(STORE_RECIPES, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_PLANS)) {
          db.createObjectStore(STORE_PLANS);
        }
        if (!db.objectStoreNames.contains(STORE_IMAGES)) {
          db.createObjectStore(STORE_IMAGES);
        }
      };
      req.onsuccess = function (e) {
        resolve(e.target.result);
      };
      req.onerror = function (e) {
        reject(e.target.error || new Error("打开数据库失败"));
      };
    });
  }

  function getDB() {
    if (!dbPromise) dbPromise = openDB();
    return dbPromise;
  }

  function tx(db, name, mode, fn) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction(name, mode);
      var settled = false;
      t.oncomplete = function () {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      t.onerror = function () {
        if (!settled) {
          settled = true;
          reject(t.error || new Error("事务失败"));
        }
      };
      t.onabort = function () {
        if (!settled) {
          settled = true;
          reject(t.error || new Error("事务中止"));
        }
      };
      try {
        fn(t);
      } catch (err) {
        if (!settled) {
          settled = true;
          reject(err);
        }
      }
    });
  }

  function getAllEntries(db, name) {
    return new Promise(function (resolve, reject) {
      var out = [];
      var req = db.transaction(name, "readonly").objectStore(name).openCursor();
      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (cursor) {
          out.push({ key: cursor.key, value: cursor.value });
          cursor.continue();
        } else {
          resolve(out);
        }
      };
      req.onerror = function (e) {
        reject(e.target.error || new Error("读取失败"));
      };
    });
  }

  // 适用于 out-of-line key 的 store（plans / images，无 keyPath）
  function putAll(db, name, entries) {
    return tx(db, name, "readwrite", function (t) {
      var os = t.objectStore(name);
      os.clear();
      entries.forEach(function (en) {
        os.put(en.value, en.key);
      });
    });
  }

  // 适用于 in-line key 的 store（recipes，keyPath = "id"）
  function putAllInline(db, name, values) {
    return tx(db, name, "readwrite", function (t) {
      var os = t.objectStore(name);
      os.clear();
      values.forEach(function (value) {
        os.put(value);
      });
    });
  }

  function clearStore(db, name) {
    return tx(db, name, "readwrite", function (t) {
      t.objectStore(name).clear();
    });
  }

  function putOne(db, name, value, key) {
    return tx(db, name, "readwrite", function (t) {
      if (key === undefined) t.objectStore(name).put(value);
      else t.objectStore(name).put(value, key);
    });
  }

  /* ---------- 工具 ---------- */

  function shallowCopy(obj) {
    var copy = {};
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) copy[k] = obj[k];
    }
    return copy;
  }

  function trackURL(url) {
    objectURLs.push(url);
    return url;
  }

  function revokeAllURLs() {
    objectURLs.forEach(function (url) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
    });
    objectURLs = [];
  }

  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(reader.error || new Error("读取图片失败"));
      };
      reader.readAsDataURL(blob);
    });
  }

  function dataURLToBlob(dataUrl) {
    return new Promise(function (resolve, reject) {
      try {
        var parts = dataUrl.split(",");
        var mime = (parts[0].match(/:(.*?);/) || [])[1] || "image/jpeg";
        var bin = atob(parts[1]);
        var len = bin.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
        resolve(new Blob([bytes], { type: mime }));
      } catch (e) {
        reject(e);
      }
    });
  }

  /* ---------- 图片压缩 / 入库 ---------- */

  // src 为 dataURL 或 blob: URL，返回压缩后的 JPEG Blob（长边 ≤1000）
  store.compressImage = function (src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var isBlob = src.indexOf("blob:") === 0;
      img.onload = function () {
        try {
          var naturalW = img.naturalWidth || img.width || 1;
          var naturalH = img.naturalHeight || img.height || 1;
          var max = 1000;
          var scale = Math.min(1, max / Math.max(naturalW, naturalH));
          var w = Math.max(1, Math.round(naturalW * scale));
          var h = Math.max(1, Math.round(naturalH * scale));
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          if (isBlob) {
            try {
              URL.revokeObjectURL(src);
            } catch (e) {}
          }
          canvas.toBlob(function (blob) {
            if (blob) resolve(blob);
            else reject(new Error("图片压缩失败"));
          }, "image/jpeg", 0.72);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = function () {
        if (isBlob) {
          try {
            URL.revokeObjectURL(src);
          } catch (e) {}
        }
        reject(new Error("图片读取失败"));
      };
      img.src = src;
    });
  };

  store.blobURL = function (blob) {
    return trackURL(URL.createObjectURL(blob));
  };

  store.saveImage = function (blob) {
    var key = "img-" + Date.now() + "-" + Math.floor(Math.random() * 1e6);
    return getDB()
      .then(function (db) {
        return putOne(db, STORE_IMAGES, blob, key);
      })
      .then(function () {
        return key;
      });
  };

  /* ---------- 序列化 / 持久化 ---------- */

  function stripRecipes(recipes) {
    return (recipes || []).map(function (r) {
      var copy = shallowCopy(r);
      delete copy.image; // 运行时对象 URL 不落库
      return copy;
    });
  }

  function persistNow() {
    if (!available) return Promise.resolve();
    return getDB()
      .then(function (db) {
        var recipes = stripRecipes(VS.recipes);
        var plans = [];
        Object.keys(VS.plans || {}).forEach(function (k) {
          plans.push({ key: k, value: VS.plans[k] });
        });
        return putAllInline(db, STORE_RECIPES, recipes).then(function () {
          return putAll(db, STORE_PLANS, plans);
        });
      })
      .catch(function (err) {
        if (window.console) console.error("持久化失败", err);
      });
  }

  store.schedulePersist = function () {
    if (!available) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(persistNow, 300);
  };

  store.persistNow = persistNow;

  /* ---------- 重建图片对象 URL ---------- */

  function rebuildImageURLs(db, recipes) {
    revokeAllURLs();
    return getAllEntries(db, STORE_IMAGES).then(function (images) {
      var map = {};
      images.forEach(function (e) {
        map[e.key] = e.value;
      });
      recipes.forEach(function (r) {
        delete r.image;
        if (r.imageKey && map[r.imageKey]) {
          r.image = trackURL(URL.createObjectURL(map[r.imageKey]));
        }
      });
    });
  }

  /* ---------- 孤立图片回收（启动时执行，规避同会话撤销窗口） ---------- */

  function gcImages(db) {
    var used = {};
    VS.recipes.forEach(function (r) {
      if (r.imageKey) used[r.imageKey] = true;
    });
    return getAllEntries(db, STORE_IMAGES).then(function (entries) {
      var orphans = entries.filter(function (e) {
        return !used[e.key];
      });
      if (!orphans.length) return;
      return tx(db, STORE_IMAGES, "readwrite", function (t) {
        var os = t.objectStore(STORE_IMAGES);
        orphans.forEach(function (e) {
          os.delete(e.key);
        });
      }).catch(function (err) {
        if (window.console) console.error("图片回收失败", err);
      });
    });
  }

  /* ---------- 启动 hydrate ---------- */

  store.boot = function () {
    if (!available) return Promise.resolve({ persisted: false });
    return getDB()
      .then(function (db) {
        return getAllEntries(db, STORE_RECIPES).then(function (recipeEntries) {
          var loadedRecipes = recipeEntries.map(function (e) {
            return e.value;
          });
          if (loadedRecipes.length) {
            VS.recipes = loadedRecipes;
          } else {
            // 首次运行：把示例数据写入
            return putAllInline(db, STORE_RECIPES, stripRecipes(VS.recipes));
          }
        }).then(function () {
          return getAllEntries(db, STORE_PLANS).then(function (planEntries) {
            if (planEntries.length) {
              var plans = {};
              planEntries.forEach(function (e) {
                plans[e.key] = e.value;
              });
              VS.plans = plans;
            } else {
              var entries = [];
              Object.keys(VS.plans || {}).forEach(function (k) {
                entries.push({ key: k, value: VS.plans[k] });
              });
              return putAll(db, STORE_PLANS, entries);
            }
          });
        }).then(function () {
          return rebuildImageURLs(db, VS.recipes);
        }).then(function () {
          return gcImages(db);
        }).then(function () {
          return { persisted: true };
        });
      })
      .catch(function (err) {
        if (window.console) console.error("本地存储不可用，使用内存模式", err);
        return { persisted: false };
      });
  };

  /* ---------- 持久化请求 ---------- */

  store.requestPersist = function () {
    try {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage
          .persist()
          .then(function (granted) {
            if (window.console) console.info("持久化存储：" + (granted ? "已启用" : "未启用"));
          })
          .catch(function () {});
      }
    } catch (e) {}
  };

  store.isAvailable = function () {
    return available;
  };

  /* ---------- 导出 / 导入 ---------- */

  function buildExport(recipes) {
    return {
      app: "huoshan-yanxuan",
      version: 1,
      exportedAt: new Date().toISOString(),
      recipes: recipes,
      plans: JSON.parse(JSON.stringify(VS.plans || {}))
    };
  }

  store.exportData = function () {
    if (!available) {
      return Promise.resolve(JSON.stringify(buildExport(VS.recipes)));
    }
    return getDB().then(function (db) {
      return getAllEntries(db, STORE_IMAGES).then(function (images) {
        var map = {};
        images.forEach(function (e) {
          map[e.key] = e.value;
        });
        return Promise.all(
          VS.recipes.map(function (r) {
            var copy = shallowCopy(r);
            delete copy.image;
            if (copy.imageKey && map[copy.imageKey]) {
              return blobToDataURL(map[copy.imageKey]).then(function (dataUrl) {
                copy.image = dataUrl;
                return copy;
              });
            }
            return Promise.resolve(copy);
          })
        ).then(function (recipeCopies) {
          return JSON.stringify(buildExport(recipeCopies));
        });
      });
    });
  };

  store.importData = function (json) {
    var data;
    try {
      data = JSON.parse(json);
    } catch (e) {
      return Promise.reject(new Error("不是有效的备份文件"));
    }
    if (!data || data.app !== "huoshan-yanxuan" || !Array.isArray(data.recipes)) {
      return Promise.reject(new Error("备份文件结构不正确"));
    }

    var recipesIn = data.recipes.map(function (r) {
      var copy = shallowCopy(r);
      delete copy.image;
      if (!copy.imageKey) delete copy.imageKey;
      return copy;
    });

    if (!available) {
      data.recipes.forEach(function (r, i) {
        if (r.image && r.image.indexOf("data:") === 0) recipesIn[i].image = r.image;
      });
      VS.recipes = recipesIn;
      VS.plans = JSON.parse(JSON.stringify(data.plans || {}));
      VS.emitChange();
      return Promise.resolve(true);
    }

    return getDB()
      .then(function (db) {
        return clearStore(db, STORE_IMAGES).then(function () {
          return Promise.all(
            data.recipes.map(function (r, i) {
              if (r.image && r.image.indexOf("data:") === 0 && recipesIn[i].imageKey) {
                return dataURLToBlob(r.image).then(function (blob) {
                  return putOne(db, STORE_IMAGES, blob, recipesIn[i].imageKey).then(function () {
                    return recipesIn[i];
                  });
                });
              }
              return Promise.resolve(recipesIn[i]);
            })
          ).then(function (recipes) {
            VS.recipes = recipes;
            VS.plans = JSON.parse(JSON.stringify(data.plans || {}));
            return rebuildImageURLs(db, VS.recipes).then(function () {
              return persistNow();
            });
          });
        });
      })
      .then(function () {
        VS.emitChange();
        return true;
      });
  };

  /* ---------- 卸载清理对象 URL ---------- */

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", revokeAllURLs);
    window.addEventListener("beforeunload", revokeAllURLs);
  }
})();
