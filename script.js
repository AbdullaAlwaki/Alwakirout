// --- إعداد الخريطة ---
      const map = L.map("map").setView([0, 0], 2); // سنقوم بتحديث هذه الإحداثيات لاحقًا
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      // --- معايير البحث ---
      const nominatimParams = "format=json&addressdetails=1&accept-language=ar";

      // --- عناصر الواجهة ---
      const sheet = document.getElementById("sheet");
      const handle = document.getElementById("handle");
      const originInput = document.getElementById("originInput");
      const stopsList = document.getElementById("stopsList");
      const stopInput = document.getElementById("stopInput");
      const originSug = document.getElementById("originSug");
      const stopSug = document.getElementById("stopSug");

      // --- حالة التطبيق ---
      let originCoords, originMarker, routingControl;
      let stops = JSON.parse(localStorage.getItem("stops") || "[]");
      let stopMarkers = [];

      // --- عناصر شريط الأيقونات العلوي ---
      const locationBtn = document.getElementById("locationBtn");
      const saveRouteBtn = document.getElementById("saveRouteBtn");
      const importGPXBtn = document.getElementById("importGPXBtn");
      const exportGPXBtn = document.getElementById("exportGPXBtn");
      const shareRouteBtn = document.getElementById("shareRouteBtn");
      const clearRouteBtn = document.getElementById("clearRouteBtn");
      const gpxFileInput = document.getElementById("gpxFileInput");

      // Debounce utility
      function debounce(fn, delay) {
        let timer;
        return function (...args) {
          clearTimeout(timer);
          timer = setTimeout(() => fn.apply(this, args), delay);
        };
      }

      // Loading indicator
      function showLoading(target) {
        target.innerHTML = '<li style="color:#10b981">جاري البحث...</li>';
        target.style.display = "block";
      }

      // --- Address Suggestions with Debounce, Loading, Error Handling ---
      originInput.addEventListener(
        "input",
        debounce(async () => {
          originInput.placeholder = "جاري البحث...";
          const q = originInput.value.trim();
          if (q.length < 2) {
            originSug.style.display = "none";
            originInput.placeholder = "نقطة البداية (اضغط للاختيار)";
            return;
          }
          showLoading(originSug);
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?${nominatimParams}&q=${encodeURIComponent(
                q
              )}&limit=5`
            );
            const data = await response.json();
            console.log("Origin suggestions:", data);
            originSug.innerHTML = "";
            if (data.length === 0) {
              originSug.style.display = "none";
              originInput.placeholder = "نقطة البداية (اضغط للاختيار)";
              return;
            }
            data.forEach((p) => {
              const li = document.createElement("li");
              li.textContent = p.display_name;
              li.onclick = () => {
                originInput.value = p.display_name;
                originCoords = [+p.lat, +p.lon];
                originSug.style.display = "none";
                setOrigin();
                routeStops();
              };
              originSug.appendChild(li);
            });
            originSug.style.display = "block";
          } catch (error) {
            alert("خطأ في البحث: " + error.message);
            originSug.style.display = "none";
          } finally {
            originInput.placeholder = "نقطة البداية (اضغط للاختيار)";
          }
        }, 300)
      );

      stopInput.addEventListener(
        "input",
        debounce(async () => {
          stopInput.placeholder = "جاري البحث...";
          const q = stopInput.value.trim();
          if (q.length < 2) {
            stopSug.style.display = "none";
            stopInput.placeholder = "ابحث عن محطة توقف أو عنوان كامل";
            return;
          }
          showLoading(stopSug);
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?${nominatimParams}&q=${encodeURIComponent(
                q
              )}&limit=5`
            );
            const data = await response.json();
            console.log("Stop suggestions:", data);
            stopSug.innerHTML = "";
            if (data.length === 0) {
              stopSug.style.display = "none";
              stopInput.placeholder = "ابحث عن محطة توقف أو عنوان كامل";
              return;
            }
            data.forEach((p) => {
              const li = document.createElement("li");
              li.textContent = p.display_name;
              li.onclick = () => {
                const name =
                  prompt("اسم مخصص:", p.display_name) || p.display_name;
                if (stops.some((s) => s.name === name)) {
                  alert("المحطة موجودة بالفعل!");
                  return;
                }
                stops.push({ name, lat: +p.lat, lon: +p.lon, address: p.display_name });
                localStorage.setItem("stops", JSON.stringify(stops));
                updateStops();
                stopInput.value = "";
                stopSug.style.display = "none";
                routeStops();
              };
              stopSug.appendChild(li);
            });
            stopSug.style.display = "block";
          } catch (error) {
            alert("خطأ في البحث: " + error.message);
            stopSug.style.display = "none";
          } finally {
            stopInput.placeholder = "ابحث عن محطة توقف أو عنوان كامل";
          }
        }, 300)
      );

      // Hide suggestions when clicking outside
      window.addEventListener("click", (e) => {
        if (!originInput.contains(e.target) && !originSug.contains(e.target)) {
          originSug.style.display = "none";
        }
        if (!stopInput.contains(e.target) && !stopSug.contains(e.target)) {
          stopSug.style.display = "none";
        }
      });

      // --- Route Display: Ensure at least two waypoints ---
      function removeRoutingPanel() {
        document
          .querySelectorAll(".leaflet-routing-container")
          .forEach((panel) => panel.remove());
      }

      function routeStops() {
        if (!originCoords || stops.length < 1) {
          if (routingControl) {
            map.removeControl(routingControl);
            routingControl = null;
          }
          return;
        }
        const waypoints = [
          L.latLng(originCoords),
          ...stops.map((s) => L.latLng(s.lat, s.lon)),
        ];
        console.log("Waypoints:", waypoints);
        if (waypoints.length < 2) {
          alert("أدخل على الأقل محطة واحدة");
          return;
        }
        if (routingControl) {
          map.removeControl(routingControl);
          routingControl = null;
        }
        routingControl = L.Routing.control({
          waypoints: waypoints,
          lineOptions: {
            styles: [{ color: "#38bdf8", weight: 5, opacity: 1 }],
            extendToWaypoints: true,
          },
          router: L.Routing.osrmv1({
            serviceUrl: "https://router.project-osrm.org/route/v1",
          }),
          formatter: new L.Routing.Formatter({ units: "metric" }),
          show: false,
        }).addTo(map);
        routingControl.on("routesfound", (e) => {
          removeRoutingPanel();
        });
        routingControl.on("error", (e) => {
          removeRoutingPanel();
          alert("فشل في رسم المسار");
          console.error(e.message);
        });
      }

      // --- Bottom Sheet Handling ---
      // States
      let startY = 0;
      let startSheetY = 0;
      let isDragging = false;

      // Snap points in percentage (from bottom)
      const snapPoints = {
        full: 0,    // Fully open
        half: 50,   // Half way
        peek: 65,   // Peek view
        closed: 75   // Initial/closed state
      };

      // Helper function to get window height without address bar on mobile
      function getWindowHeight() {
        return window.innerHeight;
      }

      function getSheetHeight() {
        return sheet.offsetHeight;
      }

      // Convert percentage to pixels
      function percentToPixels(percent) {
        const windowHeight = getWindowHeight();
        const sheetHeight = getSheetHeight();
        return (windowHeight - sheetHeight) + (sheetHeight * percent / 100);
      }

      // Calculate nearest snap point
      function getNearestSnapPoint(currentY) {
        const windowHeight = getWindowHeight();
        const sheetHeight = getSheetHeight();
        const currentPercent = ((currentY - (windowHeight - sheetHeight)) / sheetHeight) * 100;
        
        let nearestPoint = snapPoints.closed;
        let minDistance = Math.abs(currentPercent - snapPoints.closed);
        
        for (const point of Object.values(snapPoints)) {
          const distance = Math.abs(currentPercent - point);
          if (distance < minDistance) {
            minDistance = distance;
            nearestPoint = point;
          }
        }
        
        return nearestPoint;
      }

      // Common end drag handling
      function endDragging() {
        if (!isDragging) return;
        isDragging = false;
        sheet.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
        sheet.classList.remove("dragging");
        
        const sheetRect = sheet.getBoundingClientRect();
        const nearestPoint = getNearestSnapPoint(sheetRect.top);
        
        // Remove all position classes
        sheet.classList.remove("open", "peek", "half");
        
        // Add appropriate class based on snap point
        if (nearestPoint === snapPoints.full) {
          sheet.classList.add("open");
        } else if (nearestPoint === snapPoints.peek) {
          sheet.classList.add("peek");
        } else if (nearestPoint === snapPoints.half) {
          sheet.classList.add("half");
        }
        
        sheet.style.transform = `translateY(${nearestPoint}%)`;
      }

      // Close bottom sheet if focus/click/touch is outside
      function closeBottomSheet() {
        sheet.classList.remove("open", "peek", "half");
        sheet.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
        sheet.style.transform = `translateY(${snapPoints.closed}%)`;
      }

      window.addEventListener("mousedown", function(e) {
        if (!sheet.contains(e.target) && !handle.contains(e.target)) {
          closeBottomSheet();
        }
      });
      window.addEventListener("touchstart", function(e) {
        if (!sheet.contains(e.target) && !handle.contains(e.target)) {
          closeBottomSheet();
        }
      });

      // --- Bottom Sheet Dragging: Make the whole sheet draggable, not just the handle ---

      // Remove handle-only listeners and add to the sheet itself
      sheet.addEventListener("touchstart", (e) => {
        // Only start drag if not on an input, textarea, button, or selectable element
        if (e.target.closest('input, textarea, button, select, .input-suggest, .suggestions, ul, li')) return;
        isDragging = true;
        startY = e.touches[0].clientY;
        startSheetY = sheet.getBoundingClientRect().top;
        sheet.style.transition = "none";
        sheet.classList.add("dragging");
      });

      document.addEventListener("touchmove", (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const deltaY = e.touches[0].clientY - startY;
        let newY = startSheetY + deltaY;
        const windowHeight = getWindowHeight();
        const sheetHeight = getSheetHeight();
        newY = Math.max(
          windowHeight - sheetHeight,
          Math.min(newY, windowHeight - (sheetHeight * 0.25))
        );
        sheet.style.transform = `translateY(${((newY - (windowHeight - sheetHeight)) / sheetHeight) * 100}%)`;
      }, { passive: false });

      document.addEventListener("touchend", endDragging);
      document.addEventListener("touchcancel", endDragging);

      sheet.addEventListener("mousedown", (e) => {
        if (e.target.closest('input, textarea, button, select, .input-suggest, .suggestions, ul, li')) return;
        isDragging = true;
        startY = e.clientY;
        startSheetY = sheet.getBoundingClientRect().top;
        sheet.style.transition = "none";
        sheet.classList.add("dragging");
        document.body.style.userSelect = "none";
      });

      document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const deltaY = e.clientY - startY;
        let newY = startSheetY + deltaY;
        const windowHeight = getWindowHeight();
        const sheetHeight = getSheetHeight();
        newY = Math.max(
          windowHeight - sheetHeight,
          Math.min(newY, windowHeight - (sheetHeight * 0.25))
        );
        sheet.style.transform = `translateY(${((newY - (windowHeight - sheetHeight)) / sheetHeight) * 100}%)`;
      });

      document.addEventListener("mouseup", () => {
        document.body.style.userSelect = "";
        endDragging();
      });

      // Double tap/click to toggle between full and peek
      let lastTapTime = 0;
      handle.addEventListener("touchend", (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        if (tapLength < 300 && tapLength > 0) {
          sheet.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
          if (sheet.classList.contains("open")) {
            sheet.classList.remove("open");
            sheet.classList.add("peek");
            sheet.style.transform = `translateY(${snapPoints.peek}%)`;
          } else {
            sheet.classList.remove("peek", "half");
            sheet.classList.add("open");
            sheet.style.transform = `translateY(${snapPoints.full}%)`;
          }
        }
        lastTapTime = currentTime;
      });

      sheet.addEventListener('focusin', function(e) {
        if (e.target.matches('input, textarea, select')) {
          sheet.classList.add('open');
          sheet.classList.remove('peek', 'half');
          sheet.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
          sheet.style.transform = 'translateY(0)';
        }
      });

      // --- تحديد موقع البلد بناءً على IP ---
      async function setCountryFromIP() {
        try {
          const response = await fetch("https://ipapi.co/json/");
          const data = await response.json();
          if (data.country && data.latitude && data.longitude) {
            map.setView([data.latitude, data.longitude], 6);
            originInput.placeholder = `موقعك في ${
              data.region || data.country_name
            }`;
            originCoords = [data.latitude, data.longitude];
            setOrigin();
            routeStops();
          } else {
            map.setView([0, 0], 2);
            originInput.placeholder = "نقطة البداية (اضغط للاختيار)";
            originCoords = null;
          }
        } catch (error) {
          console.error("فشل في تحديد موقع IP:", error);
          map.setView([0, 0], 2);
          originCoords = null;
        }
      }

      // --- تحديث نقطة البداية ---
      function setOrigin() {
        if (originMarker) map.removeLayer(originMarker);
        if (originCoords) {
          originMarker = L.marker(originCoords, {
            icon: L.divIcon({
              className: 'custom-marker origin-marker',
              html: '<div style="display:none"></div>',
              iconSize: [38, 38],
              iconAnchor: [19, 19],
            })
          })
            .addTo(map)
            .bindPopup("نقطة البداية")
            .openPopup();
          map.setView(originCoords, 14);
        }
      }

      // --- عند تحميل الصفحة ---
      window.onload = () => {
        setCountryFromIP();
        updateStops();
        setupButtonEvents();
      };

      // --- تفعيل الأزرار ---
      function setupButtonEvents() {
        // زر تحديد الموقع
        locationBtn.addEventListener("click", () => {
          if (!navigator.geolocation) {
            alert("الموقع غير مدعوم في هذا المتصفح");
            return;
          }
          originInput.value = "جاري تحديد موقعي...";
          navigator.geolocation.getCurrentPosition(
            (position) => {
              originCoords = [
                position.coords.latitude,
                position.coords.longitude,
              ];
              originInput.value = "موقعي الحالي";
              setOrigin();
              routeStops();
              map.setView(originCoords, 14);
            },
            (error) => {
              console.warn("خطأ في الحصول على الموقع:", error);
              originInput.value = "";
              originInput.placeholder = "نقطة البداية (اضغط للاختيار)";
              alert("لم تتم الموافقة على الوصول للموقع أو حدث خطأ في تحديده");
              setCountryFromIP();
            },
            {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0,
            }
          );
        });

        // --- حفظ المسار ---
        saveRouteBtn.addEventListener("click", () => {
          if (stops.length === 0 && !originCoords) {
            alert("لا يوجد مسار لحفظه");
            return;
          }
          const name = prompt("أدخل اسم المسار:");
          if (!name) return;
          const saved = JSON.parse(localStorage.getItem("savedRoutes") || "[]");
          saved.push({ name, origin: originCoords, stops });
          localStorage.setItem("savedRoutes", JSON.stringify(saved));
          alert("تم حفظ المسار");
        });

        // --- مشاركة المسار ---
        shareRouteBtn.addEventListener("click", () => {
          if (!originCoords || stops.length === 0) {
            alert("لا يوجد مسار لمشاركته");
            return;
          }
          const routeData = {
            origin: originCoords,
            stops: stops.map((s) => [s.lat, s.lon]),
          };
          const encoded = encodeURIComponent(JSON.stringify(routeData));
          const url = `${window.location.href.split("?")[0]}?route=${encoded}`;
          if (navigator.clipboard) {
            navigator.clipboard
              .writeText(url)
              .then(() => {
                alert("تم نسخ الرابط للحافظة! يمكنك مشاركته الآن.");
              })
              .catch(() => {
                prompt("يرجى نسخ الرابط أدناه:", url);
              });
          } else {
            prompt("يرجى نسخ الرابط أدناه:", url);
          }
        });

        // --- تصدير GPX ---
        exportGPXBtn.addEventListener("click", () => {
          if (stops.length === 0) {
            alert("لا يوجد مسار لتصديره");
            return;
          }
          // Only export stops, not the origin
          const waypoints = stops.map((s, i) => ({
            lat: s.lat,
            lon: s.lon,
            name: s.name || `محطة ${i + 1}`,
            address: s.address || ""
          }));
          if (waypoints.length < 1) return alert("لا توجد نقاط لتصديرها");
          let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Alwaki Route" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata>\n    <name>مسار من Alwaki Route</name>\n    <desc>تم إنشاء المسار باستخدام Alwaki Route</desc>\n    <time>${new Date().toISOString()}</time>\n  </metadata>`;
          waypoints.forEach((w) => {
            let desc = w.address ? w.address : "نقطة من Alwaki Route";
            gpx += `<wpt lat="${w.lat}" lon="${w.lon}">\n  <name>${w.name}</name>\n  <desc>${desc}</desc>\n</wpt>`;
          });
          gpx += `</gpx>`;
          const blob = new Blob([gpx], { type: "application/gpx+xml" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `alwaki-route-${Date.now()}.gpx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });

        // --- استيراد GPX ---
        importGPXBtn.addEventListener("click", () => {
          gpxFileInput.click();
        });
        gpxFileInput.addEventListener("change", (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(reader.result, "text/xml");
            const gpxNodes = xmlDoc.getElementsByTagName("wpt");
            if (gpxNodes.length === 0) {
              alert("الملف غير يحتوي على نقاط مسار");
              return;
            }
            stops = [];
            for (let i = 0; i < gpxNodes.length; i++) {
              const node = gpxNodes[i];
              const lat = parseFloat(node.getAttribute("lat"));
              const lon = parseFloat(node.getAttribute("lon"));
              const nameElement = node.getElementsByTagName("name")[0];
              const descElement = node.getElementsByTagName("desc")[0];
              const name = nameElement ? nameElement.textContent : `محطة ${i + 1}`;
              const address = descElement ? descElement.textContent : "";
              if (!isNaN(lat) && !isNaN(lon)) {
                stops.push({ name, lat, lon, address });
              }
            }
            if (stops.length > 0) {
              localStorage.setItem("stops", JSON.stringify(stops));
              updateStops();
              routeStops();
              alert(`تم استيراد ${stops.length} نقطة بنجاح`);
            } else {
              alert("فشل قراءة النقاط من ملف GPX");
            }
          };
          reader.onerror = () => {
            alert("خطأ في قراءة ملف GPX");
          };
          reader.readAsText(file);
        });

        // --- مسح المسار ---
        clearRouteBtn.addEventListener("click", () => {
          if (!confirm("هل تريد مسح كل المحطات والنقطة البداية؟")) return;
          stops = [];
          originCoords = null;
          originInput.value = "";
          if (originMarker) {
            map.removeLayer(originMarker);
            originMarker = null;
          }
          localStorage.removeItem("stops");
          updateStops();
          if (routingControl) map.removeControl(routingControl);
          setCountryFromIP();
        });
      }

      // --- تحديث قائمة المحطات ---
      function updateStops() {
        stopsList.innerHTML = "";
        // Remove all stop markers from the map
        if (stopMarkers) {
            stopMarkers.forEach((marker) => map.removeLayer(marker));
        }
        stopMarkers = [];
        // إضافة ماركر مخصص لكل محطة
        stops.forEach((s, i) => {
            const div = document.createElement("div");
            div.className = "list-item";
            div.draggable = false; // never draggable by default
            div.dataset.index = i;
            // Extract street number and name (first part before comma)
            const addressShort = (s.address || '').split(',')[0];
            div.innerHTML = `
              <span>${s.name}</span><br>
              <small style='color:#888;cursor:pointer'>${addressShort}</small>
              <button class="stop-hamburger" aria-label="خيارات السحب" style="background:none;border:none;cursor:grab;padding:0 8px;font-size:1.5em;vertical-align:middle;">&#9776;</button>
              <button onclick="delStop(${i})" aria-label="حذف المحطة">🗑️</button>
              <button onclick="openInGoogleMaps(${i})" aria-label="فتح في خرائط Google" style="background:#2563eb;color:#fff">🗺️</button>
            `;
            // إضافة ماركر دائري باسم المحطة (أول حرف أو رقم المحطة)
            const markerLabel = s.name.length > 2 ? s.name[0] : s.name;
            const marker = L.marker([s.lat, s.lon], {
                icon: L.divIcon({
                    className: 'custom-stop-marker',
                    html: `<div style="width:38px;height:38px;background:#334155;color:#fff;font-weight:bold;border-radius:50%;box-shadow:0 4px 18px #10b98155,0 1px 0 #fff2 inset;font-size:1.13em;white-space:nowrap;display:flex;align-items:center;justify-content:center;letter-spacing:0.5px;overflow:hidden;user-select:none;">${markerLabel}</div>`
                })
            }).addTo(map).bindTooltip(s.name, {direction:'top',offset:[0,-20],className:'marker-tooltip'});
            stopMarkers.push(marker);

            // Only hamburger triggers drag
            const hamburger = div.querySelector('.stop-hamburger');
            hamburger.addEventListener("mousedown", (e) => {
                if (window.innerWidth >= 1024) {
                    div.draggable = true;
                }
            });
            // إعادة تعيين draggable عند نهاية السحب أو عند الخروج
            hamburger.addEventListener("mouseup", (e) => {
                if (window.innerWidth >= 1024) {
                    div.draggable = false;
                }
            });
            div.addEventListener("mouseleave", (e) => {
                if (window.innerWidth >= 1024) {
                    div.draggable = false;
                }
            });
            div.addEventListener("dragend", () => {
                div.classList.remove("dragging");
                document.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
                div.draggable = false;
            });
            // Drag and drop handlers
            div.addEventListener("dragstart", (e) => {
                if (!div.draggable) {
                    e.preventDefault();
                    return;
                }
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", i);
                div.classList.add("dragging");
            });
            div.addEventListener("dragover", (e) => {
                e.preventDefault();
                div.classList.add("drag-over");
            });
            div.addEventListener("dragleave", () => {
                div.classList.remove("drag-over");
            });
            div.addEventListener("drop", (e) => {
                e.preventDefault();
                div.classList.remove("drag-over");
                const from = +e.dataTransfer.getData("text/plain");
                const to = i;
                if (from !== to) {
                    const moved = stops.splice(from, 1)[0];
                    stops.splice(to, 0, moved);
                    localStorage.setItem("stops", JSON.stringify(stops));
                    updateStops();
                    routeStops();
                }
            });

            function editStopHandler() {
                const newStopName = prompt("تعديل اسم المحطة:", s.name);
                const newAddress = prompt("تعديل العنوان:", s.address || "");
                if (newStopName) stops[i].name = newStopName;
                if (newAddress !== null) stops[i].address = newAddress;
                localStorage.setItem("stops", JSON.stringify(stops));
                updateStops();
                routeStops();
            }

            div.querySelector("span").onclick = editStopHandler;
            const addressElem = div.querySelector("small");
            if (addressElem) addressElem.onclick = editStopHandler;

            stopsList.appendChild(div);
        });
      }

      // Touch drag-and-drop for stopsList
      let touchDragIndex = null;
      let dragTimeout = null;
      stopsList.addEventListener(
        "touchstart",
        function (e) {
          if (e.touches.length > 1) return;
          const hamburger = e.target.closest('.stop-hamburger');
          const target = e.target.closest('.list-item');
          if (!target || !hamburger) return;
          dragTimeout = setTimeout(() => {
            touchDragIndex = +target.dataset.index;
            target.classList.add("dragging");
            stopsList.setAttribute('data-dragging', 'true');
          }, 300); // 300ms for long press
        },
        { passive: true }
      );
      stopsList.addEventListener(
        "touchmove",
        function (e) {
          if (touchDragIndex === null) {
            clearTimeout(dragTimeout);
            return; // allow scroll if not dragging
          }
          e.preventDefault();
          const touch = e.touches[0];
          const overElem = document.elementFromPoint(
            touch.clientX,
            touch.clientY
          );
          const overItem = overElem && overElem.closest(".list-item");
          stopsList
            .querySelectorAll(".drag-over")
            .forEach((el) => el.classList.remove("drag-over"));
          if (overItem && +overItem.dataset.index !== touchDragIndex) {
            overItem.classList.add("drag-over");
          }
        },
        { passive: false }
      );
      stopsList.addEventListener(
        "touchend",
        function (e) {
          clearTimeout(dragTimeout);
          if (touchDragIndex === null) return;
          const touch = e.changedTouches[0];
          const overElem = document.elementFromPoint(
            touch.clientX,
            touch.clientY
          );
          const overItem = overElem && overElem.closest(".list-item");
          stopsList
            .querySelectorAll(".drag-over")
            .forEach((el) => el.classList.remove("drag-over"));
          const from = touchDragIndex;
          let to = from;
          if (overItem) to = +overItem.dataset.index;
          if (from !== to) {
            const moved = stops.splice(from, 1)[0];
            stops.splice(to, 0, moved);
            localStorage.setItem("stops", JSON.stringify(stops));
            updateStops();
            routeStops();
          }
          const dragging = stopsList.querySelector(".dragging");
          if (dragging) dragging.classList.remove("dragging");
          stopsList.removeAttribute('data-dragging');
          touchDragIndex = null;
        },
        { passive: false }
      );

      // --- حذف محطة ---
      window.delStop = (i) => {
        stops.splice(i, 1);
        localStorage.setItem("stops", JSON.stringify(stops));
        updateStops();
        routeStops();
      };

      window.openInGoogleMaps = (i) => {
        const stop = stops[i];
        const url = `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lon}`;
        window.open(url, '_blank');
      };

      window.openRouteInGoogleMaps = () => {
        let url = 'https://www.google.com/maps/dir/?api=1';
        if (originCoords) {
          url += `&origin=${originCoords[0]},${originCoords[1]}`;
        }
        if (stops.length > 0) {
          url += `&destination=${stops[stops.length-1].lat},${stops[stops.length-1].lon}`;
          if (stops.length > 1) {
            const waypoints = stops.slice(0, -1).map(s => `${s.lat},${s.lon}`).join('|');
            url += `&waypoints=${encodeURIComponent(waypoints)}`;
          }
        }
        window.open(url, '_blank');
      };

      // --- تحميل المسار من الرابط ---
      window.addEventListener("load", () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has("route")) {
          try {
            const routeData = JSON.parse(
              decodeURIComponent(urlParams.get("route"))
            );
            originCoords = routeData.origin;
            originInput.value = "مسار مشترك";
            stops = routeData.stops.map((coords, index) => ({
              name: `محطة ${index + 1}`,
              lat: coords[0],
              lon: coords[1],
            }));
            localStorage.setItem("stops", JSON.stringify(stops));
            updateStops();
            setOrigin();
            routeStops();
            window.history.replaceState({}, "", window.location.pathname);
          } catch (e) {
            console.error("فشل تحميل المسار من الرابط:", e);
          }
        }
      });