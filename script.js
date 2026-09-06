
        // Firebase :
const firebaseConfig = {
  apiKey: "AIzaSyBu8B_1rtTuTX0Uzja4W6ZKmfDdHmHvnTc",
  authDomain: "bola-school-app.firebaseapp.com",
  projectId: "bola-school-app",
  storageBucket: "bola-school-app.firebasestorage.app",
  messagingSenderId: "256498313163",
  appId: "1:256498313163:web:dec18fd019f388e94d784e",
  measurementId: "G-P4B9SB60JE"
};
    firebase.initializeApp(firebaseConfig);

    const db = firebase.firestore();
    const auth = firebase.auth();
    let unsubscribeSnapshot = null; // متغير لحفظ اتصال البيانات
    const monthsList = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    let schedule = { "السبت": [], "الأحد": [], "الإثنين": [], "الثلاثاء": [], "الأربعاء": [], "الخميس": [], "الجمعة": [] };
    let evalStudents = [];
    let payStudents = [];
    let editingSlot = null;
    let editingEvalIndex = null;

    // --- نظام تسجيل الدخول والحماية ---
    auth.onAuthStateChanged((user) => {
        if (user) {
            // المستخدم مسجل دخول (إظهار التطبيق وجلب البيانات)
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            loadDataFromCloud();
        } else {
            // المستخدم غير مسجل (إظهار شاشة الدخول فقط)
            document.getElementById('loginScreen').style.display = 'flex';
            document.getElementById('mainApp').style.display = 'none';
            if(unsubscribeSnapshot) unsubscribeSnapshot(); // إيقاف جلب البيانات
        }
    });

    function loginUser() {
        const email = document.getElementById('emailInput').value.trim();
        const pass = document.getElementById('passwordInput').value.trim();
        const errorMsg = document.getElementById('loginError');
        
        if(!email || !pass) {
            errorMsg.innerText = "الرجاء إدخال الإيميل والباسورد.";
            errorMsg.style.display = "block";
            return;
        }

        auth.signInWithEmailAndPassword(email, pass)
        .then(() => {
            errorMsg.style.display = "none";
            document.getElementById('emailInput').value = '';
            document.getElementById('passwordInput').value = '';
        })
        .catch((error) => {
            errorMsg.innerText = "الإيميل أو كلمة المرور غير صحيحة.";
            errorMsg.style.display = "block";
            console.error(error);
        });
    }

    function logoutUser() {
        if(confirm("هل تريد تسجيل الخروج؟")) {
            auth.signOut();
        }
    }
 
    function saveDataToCloud() {
        if(!auth.currentUser) return; 
        db.collection("teacherData").doc("bola_data").set({
            schedule: schedule,
            evalStudents: evalStudents,
            payStudents: payStudents
        }, { merge: true })
        .then(() => {
            document.getElementById('syncStatus').innerText = "☁️ متزامن مع السحابة";
        })
        .catch((error) => {
            console.error("خطأ: ", error);
            document.getElementById('syncStatus').innerText = "⚠️ خطأ في الاتصال";
        });
    }

    function loadDataFromCloud() {
        unsubscribeSnapshot = db.collection("teacherData").doc("bola_data").onSnapshot((doc) => {
            if (doc.exists) {
                let data = doc.data();
                schedule = data.schedule || schedule;
                evalStudents = data.evalStudents || [];
                payStudents = data.payStudents || [];
                renderApp();
                document.getElementById('syncStatus').innerText = "☁️ متزامن مع السحابة";
            } else {
                saveDataToCloud();
            }
        });
    }

    function format12Hour(time24) {
        if (!time24) return '';
        let [hours, minutes] = time24.split(':');
        let h = parseInt(hours);
        let period = h >= 12 ? 'م' : 'ص';
        h = h % 12;
        h = h ? h : 12;
        return `${h}:${minutes} ${period}`;
    }

    function getTodayDateISO() {
        const d = new Date();
        let month = '' + (d.getMonth() + 1), day = '' + d.getDate(), year = d.getFullYear();
        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;
        return [year, month, day].join('-');
    }

    function calculateGrade(score, total) {
        if (!total || total <= 0) return { percent: 0, text: 'لم يتم التحديد' };
        let percent = Math.round((score / total) * 100);
        let text = '';
        if (percent >= 90) text = 'ممتاز';
        else if (percent >= 80) text = 'جيد';
        else if (percent >= 70) text = 'متوسط';
        else if (percent >= 60) text = 'تحت متوسط';
        else text = 'ضعيف';
        return { percent, text };
    }

    function toggleInfoModal() {
        let modal = document.getElementById('infoModal');
        modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
    }

    function renderApp() {
        renderSchedule();
        renderEvalStudents();
        renderPayStudents();
    }

    function saveScheduleSlot() {
        const title = document.getElementById('slotTitle').value.trim();
        const day = document.getElementById('slotDay').value;
        const time = document.getElementById('slotTime').value;
        if (!title || !time) { alert('أدخل اسم المجموعة ووقت الميعاد'); return; }
        if (editingSlot !== null) {
            schedule[editingSlot.day].splice(editingSlot.index, 1);
            editingSlot = null;
            document.getElementById('scheduleBtn').innerText = 'إضافة الميعاد';
        }
        if(!schedule[day]) schedule[day] = [];
        schedule[day].push({ title, time });
        schedule[day].sort((a, b) => a.time.localeCompare(b.time));
        saveDataToCloud();
        document.getElementById('slotTitle').value = '';
        document.getElementById('slotTime').value = '';
    }

    function toggleDayCollapse(day) {
        let daySec = document.getElementById('day-content-' + day);
        let arrow = document.getElementById('day-arrow-' + day);
        if (daySec.classList.contains('collapsed')) {
            daySec.classList.remove('collapsed');
            arrow.innerText = '🔼 (إخفاء)';
        } else {
            daySec.classList.add('collapsed');
            arrow.innerText = '🔽 (إظهار)';
        }
    }

    function editSlot(day, index) {
        let slot = schedule[day][index];
        document.getElementById('slotTitle').value = slot.title;
        document.getElementById('slotDay').value = day;
        document.getElementById('slotTime').value = slot.time;
        editingSlot = { day, index };
        document.getElementById('scheduleBtn').innerText = 'حفظ التعديل';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function deleteSlot(day, index) {
        schedule[day].splice(index, 1);
        saveDataToCloud();
    }

    function renderSchedule() {
        const container = document.getElementById('scheduleContainer');
        container.innerHTML = '';
        let total = 0;
        
        // 1. مصفوفة ثابتة لإجبار التطبيق على هذا الترتيب دائماً
        const daysOrder = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
        
        // 2. المرور على الأيام بالترتيب الصحيح
        daysOrder.forEach((day) => {
            if (schedule[day] && schedule[day].length > 0) {
                total += schedule[day].length;
                let slotsHTML = schedule[day].map((s, idx) => `
                    <div class="slot-item">
                        <div class="slot-info"><span class="slot-time">⏰ ${format12Hour(s.time)}</span><strong>${s.title}</strong></div>
                        <div style="display:flex; gap:5px;">
                            <button class="btn-icon btn-edit-sm" onclick="editSlot('${day}', ${idx})">edit</button>
                            <button class="btn-icon btn-del-sm" onclick="deleteSlot('${day}', ${idx})">del</button>
                        </div>
                    </div>
                `).join('');

                container.innerHTML += `
                    <div class="day-section">
                        <div class="day-title" onclick="toggleDayCollapse('${day}')">
                            <span>📌 يوم ${day} (${schedule[day].length} موعد)</span>
                            <span id="day-arrow-${day}" style="font-size:0.8rem;">🔼 (إخفاء)</span>
                        </div>
                        <div id="day-content-${day}" class="collapsible-content slots-grid">${slotsHTML}</div>
                    </div>
                `;
            }
        });

        if (total === 0) container.innerHTML = '<p style="color:#94a3b8; text-align:center; padding: 15px;">لا توجد مواعيد مسجلة</p>';
        document.getElementById('scheduleCount').innerText = `${total} موعد`;
    }

    function saveEvalStudent() {
        const nameEl = document.getElementById('evalStudentName');
        const phoneEl = document.getElementById('evalParentPhone');
        const dayEl = document.getElementById('evalStudentDay');

        if (!nameEl || !nameEl.value.trim()) { alert('أدخل اسم الطالب'); return; }

        const name = nameEl.value.trim();
        const parentPhone = phoneEl ? phoneEl.value.trim() : '';
        const day = dayEl ? dayEl.value : 'السبت';

        if (editingEvalIndex !== null) {
            evalStudents[editingEvalIndex].name = name;
            evalStudents[editingEvalIndex].parentPhone = parentPhone;
            evalStudents[editingEvalIndex].day = day;
            editingEvalIndex = null;
            document.getElementById('evalBtn').innerText = 'إضافة طالب للتقييمات';
            document.getElementById('evalBtn').className = 'btn-purple';
        } else {
            evalStudents.push({ name, parentPhone, day, months: {}, collapsed: false });
        }

        saveDataToCloud();
        nameEl.value = '';
        if (phoneEl) phoneEl.value = '';
    }

    function toggleStudentCollapse(sIdx) {
        evalStudents[sIdx].collapsed = !evalStudents[sIdx].collapsed;
        saveDataToCloud();
    }

    function addMonthToStudent(sIdx) {
        let availableMonths = monthsList.filter(m => !evalStudents[sIdx].months[m]);
        if (availableMonths.length === 0) { alert('تمت إضافة جميع الشهور!'); return; }
        let chosenMonth = prompt(`اختر الشهر المراد إضافته:\n${availableMonths.join(', ')}`, availableMonths[0]);
        if (!chosenMonth || !monthsList.includes(chosenMonth)) return;

        evalStudents[sIdx].months[chosenMonth] = {
            weeks: { "الأسبوع الأول": "ممتاز", "الأسبوع الثاني": "ممتاز", "الأسبوع الثالث": "ممتاز", "الأسبوع الرابع": "ممتاز" },
            examScore: 0, examTotal: 100, collapsed: false
        };
        saveDataToCloud();
    }

    function toggleMonthCollapse(sIdx, monthName) {
        evalStudents[sIdx].months[monthName].collapsed = !evalStudents[sIdx].months[monthName].collapsed;
        saveDataToCloud();
    }

    function removeMonthFromStudent(sIdx, monthName) {
        if (confirm(`حذف شهر ${monthName}؟`)) {
            delete evalStudents[sIdx].months[monthName];
            saveDataToCloud();
        }
    }

    function updateStudentWeek(sIdx, monthName, weekName, val) {
        evalStudents[sIdx].months[monthName].weeks[weekName] = val;
        saveDataToCloud();
    }

    function updateStudentMonthExam(sIdx, monthName, field, val) {
        evalStudents[sIdx].months[monthName][field] = val;
        saveDataToCloud();
    }

    function addCustomWeek(sIdx, monthName) {
        let weekTitle = prompt('أدخل اسم الأسبوع أو الإجازة:');
        if (!weekTitle) return;
        evalStudents[sIdx].months[monthName].weeks[weekTitle] = 'جيد';
        saveDataToCloud();
    }

    function removeWeek(sIdx, monthName, weekName) {
        delete evalStudents[sIdx].months[monthName].weeks[weekName];
        saveDataToCloud();
    }

    function editEvalStudent(index) {
        let s = evalStudents[index];
        document.getElementById('evalStudentName').value = s.name;
        document.getElementById('evalParentPhone').value = s.parentPhone || '';
        document.getElementById('evalStudentDay').value = s.day;
        editingEvalIndex = index;
        let btn = document.getElementById('evalBtn');
        btn.innerText = 'حفظ التعديل';
        btn.className = 'btn-warning';
        window.scrollTo({ top: 300, behavior: 'smooth' });
    }

    function deleteEvalStudent(index) {
        if (confirm('حذف سجل تقييم الطالب؟')) {
            evalStudents.splice(index, 1);
            saveDataToCloud();
        }
    }

    function sendWhatsAppReport(sIdx, monthName) {
        let s = evalStudents[sIdx];
        if (!s.parentPhone) { alert('أدخل رقم ولي الأمر!'); return; }
        let mData = s.months[monthName];
        let grade = calculateGrade(mData.examScore, mData.examTotal);
        let weeksSummary = Object.entries(mData.weeks).map(([wName, wVal]) => `- ${wName}: ${wVal}`).join('\n');
        let msg = `مساء الخير، ولي أمر الطالب/ة المحترم (${s.name}).\n\nنحيطكم علماً بتقرير شهر (${monthName}):\n\nالتقييمات الأسبوعية:\n${weeksSummary}\n\nنتيجة الامتحان الشهري الشامل: ${mData.examScore} من ${mData.examTotal} (${grade.percent}%)\nالتقدير العام: ${grade.text}\n\nمستر بولا فوزى استاذ الكيمياء`;
        let phone = s.parentPhone.startsWith('0') ? '+20' + s.parentPhone.slice(1) : s.parentPhone;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    }

    function renderEvalStudents() {
        const container = document.getElementById('evalContainer');
        container.innerHTML = '';
        let searchQuery = document.getElementById('searchInput').value.trim().toLowerCase();
        let filtered = evalStudents.filter(s => s.name.toLowerCase().includes(searchQuery));

        filtered.forEach((s) => {
            let sIdx = evalStudents.indexOf(s);
            let monthsHTML = '';
            let addedMonthsKeys = Object.keys(s.months);
            let isStudentCollapsed = s.collapsed || false;

            if (addedMonthsKeys.length === 0) {
                monthsHTML = `<p style="color:#94a3b8; font-size:0.85rem; text-align:center; padding:10px;">لا توجد شهور مضافة.</p>`;
            } else {
                for (let monthName of addedMonthsKeys) {
                    let mData = s.months[monthName];
                    let grade = calculateGrade(mData.examScore, mData.examTotal);
                    let isCollapsed = mData.collapsed || false;

                    let weeksHTML = Object.entries(mData.weeks).map(([weekName, weekVal]) => `
                        <div class="week-item">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <label>${weekName}</label>
                                <span onclick="removeWeek(${sIdx}, '${monthName}', '${weekName}')" style="cursor:pointer; color:red; font-size:0.7rem;">×</span>
                            </div>
                            <select onchange="updateStudentWeek(${sIdx}, '${monthName}', '${weekName}', this.value)" style="margin-top:4px; padding:4px; font-size:0.8rem;">
                                <option value="ممتاز" ${weekVal === 'ممتاز' ? 'selected' : ''}>ممتاز</option>
                                <option value="جيد" ${weekVal === 'جيد' ? 'selected' : ''}>جيد</option>
                                <option value="متوسط" ${weekVal === 'متوسط' ? 'selected' : ''}>متوسط</option>
                                <option value="تحت متوسط" ${weekVal === 'تحت متوسط' ? 'selected' : ''}>تحت متوسط</option>
                                <option value="ضعيف" ${weekVal === 'ضعيف' ? 'selected' : ''}>ضعيف</option>
                                <option value="إجازة" ${weekVal === 'إجازة' ? 'selected' : ''}>إجازة</option>
                            </select>
                        </div>
                    `).join('');

                    monthsHTML += `
                        <div class="month-box">
                            <div class="month-header">
                                <strong style="color:var(--purple-color); cursor:pointer;" onclick="toggleMonthCollapse(${sIdx}, '${monthName}')">
                                    📅 شهر ${monthName} ${isCollapsed ? '🔽 (إظهار)' : '🔼 (إخفاء)'}
                                </strong>
                                <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">
                                    <button class="btn-small btn-purple" onclick="addCustomWeek(${sIdx}, '${monthName}')">+ أسبوع</button>
                                    ${s.parentPhone ? `<button class="btn-small btn-whatsapp" onclick="sendWhatsAppReport(${sIdx}, '${monthName}')">💬 واتساب</button>` : ''}
                                    <button class="btn-icon btn-del-sm" onclick="removeMonthFromStudent(${sIdx}, '${monthName}')">del</button>
                                </div>
                            </div>
                            <div class="collapsible-content ${isCollapsed ? 'collapsed' : ''}">
                                <div class="weeks-container">${weeksHTML}</div>
                                <div class="exam-box">
                                    <div style="display:flex; align-items:center; gap:8px; flex:1;">
                                        <label style="font-size:0.8rem; margin:0;">امتحان شهري:</label>
                                        <input type="number" value="${mData.examScore}" onchange="updateStudentMonthExam(${sIdx}, '${monthName}', 'examScore', Number(this.value))" style="width:60px; padding:4px;">
                                        <span>/</span>
                                        <input type="number" value="${mData.examTotal}" onchange="updateStudentMonthExam(${sIdx}, '${monthName}', 'examTotal', Number(this.value))" style="width:60px; padding:4px;">
                                    </div>
                                    <div style="display:flex; align-items:center; gap:6px;">
                                        <span style="font-weight:bold; font-size:0.85rem;">${grade.percent}%</span>
                                        <span class="grade-badge grade-${grade.text.replace(/\s+/g, '-')}">${grade.text}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }

            container.innerHTML += `
                <div class="student-card" style="border-right: 5px solid var(--purple-color);">
                    <div class="student-header" onclick="toggleStudentCollapse(${sIdx})">
                        <div>
                            <strong style="font-size: 1.1rem; color:var(--purple-color);">👨‍🎓 ${s.name}</strong>
                            <span style="font-size:0.8rem; background:#cbd5e1; color:#334155; padding:2px 6px; border-radius:4px; margin-right:5px;">مجموعة ${s.day}</span>
                        </div>
                        <div style="display:flex; gap:6px; align-items:center;" onclick="event.stopPropagation()">
                            <button class="btn-small btn-success" onclick="addMonthToStudent(${sIdx})">+ شهر</button>
                            <button class="btn-icon btn-edit-sm" onclick="editEvalStudent(${sIdx})">edit</button>
                            <button class="btn-icon btn-del-sm" onclick="deleteEvalStudent(${sIdx})">del</button>
                            <span style="font-size:0.8rem; font-weight:bold; cursor:pointer; color:var(--purple-color);" onclick="toggleStudentCollapse(${sIdx})">${isStudentCollapsed ? '🔽 إظهار' : '🔼 إخفاء'}</span>
                        </div>
                    </div>
                    <div class="collapsible-content ${isStudentCollapsed ? 'collapsed' : ''}" style="margin-top:5px;">
                        ${monthsHTML}
                    </div>
                </div>
            `;
        });
        if (filtered.length === 0) container.innerHTML = '<p style="color:#94a3b8; text-align:center; padding: 15px;">لا توجد نتائج</p>';
        document.getElementById('evalCount').innerText = `${evalStudents.length} طالب`;
    }

    function savePayStudent() {
        const nameEl = document.getElementById('payStudentName');
        const dayEl = document.getElementById('payStudentDay');
        if (!nameEl || !nameEl.value.trim()) { alert('أدخل اسم الطالب'); return; }
        payStudents.push({ name: nameEl.value.trim(), day: dayEl ? dayEl.value : 'السبت', payments: [], collapsed: false });
        saveDataToCloud();
        nameEl.value = '';
    }

    function togglePayStudentCollapse(index) {
        payStudents[index].collapsed = !payStudents[index].collapsed;
        saveDataToCloud();
    }

    function recordSession(index) {
        let today = getTodayDateISO();
        if (payStudents[index].payments.includes(today)) { alert('مسجل مسبقاً!'); return; }
        payStudents[index].payments.push(today);
        payStudents[index].payments.sort();
        saveDataToCloud();
    }

    function addPastSession(index) {
        let d = prompt('أدخل التاريخ (YYYY-MM-DD):', getTodayDateISO());
        if (!d) return;
        payStudents[index].payments.push(d);
        payStudents[index].payments.sort();
        saveDataToCloud();
    }

    function removePayment(sIdx, pIdx) {
        payStudents[sIdx].payments.splice(pIdx, 1);
        saveDataToCloud();
    }

    function resetPackage(index) {
        if (confirm('تصفية الـ 8 حصص؟')) {
            payStudents[index].payments = [];
            saveDataToCloud();
        }
    }

    function deletePayStudent(index) {
        if (confirm('حذف؟')) {
            payStudents.splice(index, 1);
            saveDataToCloud();
        }
    }

    function renderPayStudents() {
        const container = document.getElementById('paymentContainer');
        container.innerHTML = '';
        let searchQuery = document.getElementById('searchInput').value.trim().toLowerCase();
        let filtered = payStudents.filter(s => s.name.toLowerCase().includes(searchQuery));

        filtered.forEach((s) => {
            let index = payStudents.indexOf(s);
            let count = s.payments.length;
            let isCollapsed = s.collapsed || false;
            let alertBadge = count >= 8 ? `<span style="background:#fee2e2; color:#dc2626; padding:3px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold;">⚠️ 8 حصص</span>` : '';
            let pills = s.payments.map((date, pIdx) => `<span class="payment-pill paid">✓ ${date} <span onclick="removePayment(${index}, ${pIdx})" style="cursor:pointer; color:red;">×</span></span>`).join('');

            container.innerHTML += `
                <div class="student-card" style="border-right: 5px solid var(--success-color);">
                    <div class="student-header" onclick="togglePayStudentCollapse(${index})">
                        <div>
                            <strong style="font-size: 1.1rem; color:var(--success-color);">👨‍🎓 ${s.name}</strong>
                            <span style="font-size:0.8rem; background:#cbd5e1; color:#334155; padding:2px 6px; border-radius:4px; margin-right:5px;">مجموعة ${s.day}</span>
                            <span style="font-size:0.8rem; color:var(--primary-color); font-weight:bold;">(حصص: ${count})</span>
                        </div>
                        <div style="display:flex; gap:6px; align-items:center;" onclick="event.stopPropagation()">
                            ${alertBadge}
                            <button class="btn-icon btn-del-sm" onclick="deletePayStudent(${index})">del</button>
                            <span style="font-size:0.8rem; font-weight:bold; cursor:pointer; color:var(--success-color);" onclick="togglePayStudentCollapse(${index})">${isCollapsed ? '🔽 إظهار' : '🔼 إخفاء'}</span>
                        </div>
                    </div>
                    <div class="collapsible-content ${isCollapsed ? 'collapsed' : ''}" style="margin-top:12px;">
                        <div class="payments-container">
                            <span style="font-size:0.8rem; font-weight:bold;">الحصص:</span>
                            ${pills || '<span style="font-size:0.8rem; color:#94a3b8;">لا توجد حصص</span>'}
                        </div>
                        <div class="student-actions">
                            <button class="btn-small btn-success" onclick="recordSession(${index})">✓ حصة اليوم</button>
                            <button class="btn-small btn-warning" onclick="addPastSession(${index})">📅 حصة قديمة</button>
                            ${count >= 8 ? `<button class="btn-small btn-danger" onclick="resetPackage(${index})">🔄 تصفية</button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        if (filtered.length === 0) container.innerHTML = '<p style="color:#94a3b8; text-align:center; padding: 15px;">لا توجد نتائج</p>';
        document.getElementById('paymentCount').innerText = `${payStudents.length} طالب`;
    }
    document.addEventListener('click', function(event) {
        // تحديد ما إذا كان الضغط تم داخل المربع
        // تذكر استبدال '.student-card' باسم الكلاس الذي تستخدمه
        const box = event.target.closest('.form-box'); 

        if (box) {
            // إذا ضغطت داخل المربع، يتم تكبيره (استخدمنا add بدلاً من toggle لكي لا يغلق إذا ضغطت بداخله مرة أخرى بالخطأ)
            box.classList.add('expanded');
        } else {
            // إذا ضغطت في مكان فارغ (خارج المربع)، يتم إغلاق وتصغير كل المربعات المفتوحة
            document.querySelectorAll('.form-box.expanded').forEach(b => {
                b.classList.remove('expanded');
            });
        }
    });

    // 2. التعامل مع زر Enter للانتهاء من الكتابة
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            // عند الضغط على إنتر، يتم إغلاق أي مربع مفتوح
            document.querySelectorAll('.form-box.expanded').forEach(b => {
                b.classList.remove('expanded');
            });
        }
    });


    if ('serviceWorker' in navigator) {
window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
    .then(registration => {
        console.log('Service Worker registered successfully');
    })
    .catch(err => {
        console.log('Service Worker registration failed: ', err);
    });
});}