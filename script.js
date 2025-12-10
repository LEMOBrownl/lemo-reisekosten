// Hilfsfunktionen ------------------------------------------------------

function parseEuroToNumber(value) {
  // "47,50" -> 47.5
  if (!value) return 0;
  return Number(String(value).replace(/\./g, "").replace(",", ".")) || 0;
}

function formatEuro(num) {
  return (num || 0).toFixed(2).replace(".", ",");
}

function parseDateInput(el) {
  const v = el.value;
  if (!v) return null;
  const [yyyy, mm, dd] = v.split("-");
  if (!yyyy || !mm || !dd) return null;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

function daysBetweenInclusive(start, end) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end - start) / msPerDay) + 1;
}

// Signatur-Pads --------------------------------------------------------

function initSignaturePad(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";

  let drawing = false;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
    const y = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
    return { x: x - rect.left, y: y - rect.top };
  }

  function start(e) {
    e.preventDefault();
    drawing = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end(e) {
    if (!drawing) return;
    e.preventDefault();
    drawing = false;
  }

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  canvas.addEventListener("mouseup", end);
  canvas.addEventListener("mouseleave", end);

  canvas.addEventListener("touchstart", start);
  canvas.addEventListener("touchmove", move);
  canvas.addEventListener("touchend", end);
}

function clearCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function canvasToDataUrl(canvas) {
  return canvas.toDataURL("image/png");
}

// Hauptlogik -----------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const countrySelect = document.getElementById("countrySelect");

  const rateFullInput = document.getElementById("rateFull");
  const ratePartialInput = document.getElementById("ratePartial");
  const rateOvernightInput = document.getElementById("rateOvernight");

  const daysFullInput = document.getElementById("daysFull");
  const daysTravelInput = document.getElementById("daysTravel");
  const overnightsInput = document.getElementById("overnights");
  const totalDaysInput = document.getElementById("totalDays");

  const sumMealsInput = document.getElementById("sumMeals");
  const sumOvernightsInput = document.getElementById("sumOvernights");
  const sumOtherCostsInput = document.getElementById("sumOtherCosts");
  const sumTotalInput = document.getElementById("sumTotal");

  const anreisetagInput = document.getElementById("anreisetag");
  const rueckreisetagInput = document.getElementById("rueckreisetag");

  const extraCostsContainer = document.getElementById("extraCostsContainer");
  const btnAddCost = document.getElementById("btnAddCost");
  const btnPdf = document.getElementById("btnPdf");
  const btnReset = document.getElementById("btnReset");

  const sigEmpCanvas = document.getElementById("sigEmp");
  const sigManCanvas = document.getElementById("sigMan");

  // Signaturpads initialisieren
  initSignaturePad(sigEmpCanvas);
  initSignaturePad(sigManCanvas);

  document.querySelectorAll("[data-clear]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-clear");
      const canvas = document.getElementById(id);
      if (canvas) clearCanvas(canvas);
    });
  });

  // BMF-Dropdown befüllen
  if (typeof BMF_TABLE === "undefined") {
    console.error("BMF_TABLE ist nicht definiert – bitte bmf2025.js einbinden.");
  } else {
    const keys = Object.keys(BMF_TABLE).sort((a, b) =>
      a.localeCompare(b, "de")
    );
    keys.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      countrySelect.appendChild(opt);
    });
  }

  // Pauschalen aus Tabelle setzen
  function updateRatesFromCountry() {
    const key = countrySelect.value;
    if (!key || !BMF_TABLE[key]) {
      rateFullInput.value = "";
      ratePartialInput.value = "";
      rateOvernightInput.value = "";
      recalcSums();
      return;
    }
    const data = BMF_TABLE[key];
    rateFullInput.value = formatEuro(data.full);
    ratePartialInput.value = formatEuro(data.partial);
    rateOvernightInput.value = formatEuro(data.overnight);
    recalcFromDates();
  }

  countrySelect.addEventListener("change", updateRatesFromCountry);

  // Reisezeit -> automatische Verteilung
  function recalcFromDates() {
    const start = parseDateInput(anreisetagInput);
    const end = parseDateInput(rueckreisetagInput);
    if (!start || !end || end < start) {
      totalDaysInput.value = "";
      return;
    }

    const totalDays = daysBetweenInclusive(start, end);
    totalDaysInput.value = totalDays;

    let fullDays = Math.max(totalDays - 2, 0);
    let travelDays = totalDays >= 2 ? 2 : totalDays; // 1 Tag = 1 Anreisetag (>8h)

    daysFullInput.value = fullDays;
    daysTravelInput.value = travelDays;
    overnightsInput.value = Math.max(totalDays - 1, 0);

    recalcSums();
  }

  anreisetagInput.addEventListener("change", recalcFromDates);
  rueckreisetagInput.addEventListener("change", recalcFromDates);

  [daysFullInput, daysTravelInput, overnightsInput].forEach((el) =>
    el.addEventListener("input", recalcSums)
  );

  // Sonstige Kosten
  function addExtraCostRow() {
    const row = document.createElement("div");
    row.className = "extra-cost-row";

    const desc = document.createElement("input");
    desc.type = "text";
    desc.placeholder = "Beschreibung";

    const amount = document.createElement("input");
    amount.type = "text";
    amount.placeholder = "Betrag (€)";

    amount.addEventListener("input", recalcSums);

    const btnRemove = document.createElement("button");
    btnRemove.type = "button";
    btnRemove.className = "extra-remove";
    btnRemove.textContent = "×";
    btnRemove.addEventListener("click", () => {
      row.remove();
      recalcSums();
    });

    row.appendChild(desc);
    row.appendChild(amount);
    row.appendChild(btnRemove);

    extraCostsContainer.appendChild(row);
  }

  btnAddCost.addEventListener("click", addExtraCostRow);

  // beim Start eine Zeile einfügen
  addExtraCostRow();

  // Summen berechnen
  function recalcSums() {
    const rateFull = parseEuroToNumber(rateFullInput.value);
    const ratePartial = parseEuroToNumber(ratePartialInput.value);
    const rateOvernight = parseEuroToNumber(rateOvernightInput.value);

    const daysFull = Number(daysFullInput.value) || 0;
    const daysTravel = Number(daysTravelInput.value) || 0;
    const overnights = Number(overnightsInput.value) || 0;

    const sumMeals = daysFull * rateFull + daysTravel * ratePartial;
    const sumOvernightsVal = overnights * rateOvernight;

    sumMealsInput.value = formatEuro(sumMeals);
    sumOvernightsInput.value = formatEuro(sumOvernightsVal);

    // Sonstige Kosten
    let sumOther = 0;
    extraCostsContainer.querySelectorAll(".extra-cost-row").forEach((row) => {
      const amountInput = row.querySelector("input[type='text']:nth-child(2)");
      sumOther += parseEuroToNumber(amountInput.value);
    });

    sumOtherCostsInput.value = formatEuro(sumOther);

    const total = sumMeals + sumOvernightsVal + sumOther;
    sumTotalInput.value = formatEuro(total);
  }

  // PDF erzeugen
  btnPdf.addEventListener("click", () => {
    try {
      createPdf(canvasToDataUrl(sigEmpCanvas), canvasToDataUrl(sigManCanvas));
    } catch (e) {
      console.error(e);
      alert(
        "Fehler beim Erzeugen des PDFs. Bitte prüfe, ob jspdf.umd.min.js eingebunden ist."
      );
    }
  });

  // Formular zurücksetzen
  btnReset.addEventListener("click", () => {
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      if (el.type === "button" || el.type === "submit") return;
      if (el.id === "countrySelect") {
        el.value = "";
      } else {
        el.value = "";
      }
    });

    extraCostsContainer.innerHTML = "";
    addExtraCostRow();

    clearCanvas(sigEmpCanvas);
    clearCanvas(sigManCanvas);
  });
});

// PDF-Funktion ---------------------------------------------------------

function createPdf(sigEmpDataUrl, sigManDataUrl) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error("jsPDF nicht gefunden");
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const marginLeft = 15;
  let y = 15;

  const get = (id) => document.getElementById(id).value || "";

  // Kopf
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0, 159, 227);
  doc.text("LEMO Maschinenbau", marginLeft, y);
  y += 7;

  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text("Reisekosten / Vorschussformular", marginLeft, y);
  y += 10;

  doc.setLineWidth(0.3);
  doc.setDrawColor(0, 159, 227);
  doc.line(marginLeft, y, 195 - marginLeft, y);
  y += 5;

  // Mitarbeiter & Auftragsdaten
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Mitarbeiter- & Auftragsdaten", marginLeft, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  const name = get("name");
  const pers = get("personalnr");
  const proj = get("projekt");

  doc.text(`Name: ${name}`, marginLeft, y);
  y += 5;
  doc.text(`Personalnummer: ${pers}`, marginLeft, y);
  y += 5;
  doc.text(`Projekt / Auftrags-Nr.: ${proj}`, marginLeft, y);
  y += 8;

  // Reisezeit
  doc.setFont("helvetica", "bold");
  doc.text("Reisezeit", marginLeft, y);
  y += 5;
  doc.setFont("helvetica", "normal");

  const anreise = get("anreisetag")
    .split("-")
    .reverse()
    .join(".");
  const rueck = get("rueckreisetag")
    .split("-")
    .reverse()
    .join(".");

  doc.text(`Anreisetag: ${anreise || "-"}`, marginLeft, y);
  y += 5;
  doc.text(`Rückreisetag: ${rueck || "-"}`, marginLeft, y);
  y += 7;

  // Pauschalen
  doc.setFont("helvetica", "bold");
  doc.text("Pauschalen", marginLeft, y);
  y += 5;
  doc.setFont("helvetica", "normal");

  const country = get("countrySelect");
  doc.text(`Land / Ort laut BMF-Tabelle: ${country || "-"}`, marginLeft, y);
  y += 5;

  const rateFull = get("rateFull");
  const ratePartial = get("ratePartial");
  const rateOvernight = get("rateOvernight");

  const daysFull = get("daysFull");
  const daysTravel = get("daysTravel");
  const overnights = get("overnights");

  const sumMeals = get("sumMeals");
  const sumOvernights = get("sumOvernights");

  doc.text(`Verpflegung 24h: ${daysFull} × ${rateFull} €`, marginLeft, y);
  y += 5;
  doc.text(`An-/Abreisetage (>8h): ${daysTravel} × ${ratePartial} €`, marginLeft, y);
  y += 5;
  doc.text(`Übernachtungen: ${overnights} × ${rateOvernight} €`, marginLeft, y);
  y += 5;
  doc.text(`Summe Verpflegung: ${sumMeals} €`, marginLeft, y);
  y += 5;
  doc.text(`Summe Übernachtung: ${sumOvernights} €`, marginLeft, y);
  y += 7;

  // Sonstige Kosten
  doc.setFont("helvetica", "bold");
  doc.text("Sonstige Kosten", marginLeft, y);
  y += 5;
  doc.setFont("helvetica", "normal");

  const rows = document.querySelectorAll("#extraCostsContainer .extra-cost-row");
  rows.forEach((row) => {
    const inputs = row.querySelectorAll("input");
    const desc = inputs[0].value || "";
    const amount = inputs[1].value || "";
    if (desc || amount) {
      doc.text(`• ${desc} – ${amount} €`, marginLeft, y);
      y += 5;
    }
  });

  const sumOther = get("sumOtherCosts");
  const sumTotal = get("sumTotal");

  y += 2;
  doc.text(`Summe sonstige Kosten: ${sumOther} €`, marginLeft, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(`Gesamtbetrag Vorschuss: ${sumTotal} €`, marginLeft, y);
  y += 10;

  // Ort, Datum, Unterschriften
  doc.setFont("helvetica", "bold");
  doc.text("Ort, Datum & Unterschriften", marginLeft, y);
  y += 5;
  doc.setFont("helvetica", "normal");

  const ort = get("ort");
  const datum = get("datum")
    .split("-")
    .reverse()
    .join(".");

  doc.text(`Ort: ${ort || "-"}`, marginLeft, y);
  y += 5;
  doc.text(`Datum: ${datum || "-"}`, marginLeft, y);
  y += 10;

  const sigY = y;
  doc.text("Mitarbeiter/in", marginLeft, sigY);
  doc.text("Vorgesetzte/r", marginLeft + 80, sigY);

  // Linien
  doc.line(marginLeft, sigY + 20, marginLeft + 60, sigY + 20);
  doc.line(marginLeft + 80, sigY + 20, marginLeft + 140, sigY + 20);

  // Signatur-Bilder
  try {
    if (sigEmpDataUrl) {
      doc.addImage(sigEmpDataUrl, "PNG", marginLeft, sigY + 6, 60, 12);
    }
    if (sigManDataUrl) {
      doc.addImage(sigManDataUrl, "PNG", marginLeft + 80, sigY + 6, 60, 12);
    }
  } catch (e) {
    console.warn("Signaturbilder konnten nicht eingefügt werden:", e);
  }

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const HH = String(now.getHours()).padStart(2, "0");
  const MM = String(now.getMinutes()).padStart(2, "0");
  const timestamp = `${yyyy}-${mm}-${dd}_${HH}-${MM}`;
  const fnameName = name || "Person";
  const fnameProj = proj || "Projekt";
  const fileName = `Reisekosten_${fnameName}_${fnameProj}_${timestamp}.pdf`;
  doc.setFontSize(10);
  doc.text(`Erstellt am: ${yyyy}-${mm}-${dd} ${HH}:${MM} Uhr`, 15, 285);
  doc.save(fileName);
}




// E-Mail-Button: einheitliche Implementierung mit Android-Intent und Fallback
document.addEventListener("DOMContentLoaded", () => {
  const btnEmail = document.getElementById("btnEmail");
  const btnPdf = document.getElementById("btnPdf");

  if (!btnEmail) return;

  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = ua.includes("android");
  const isFirefox = ua.includes("firefox");

  btnEmail.addEventListener("click", () => {
    try {
      const subject = buildMailSubject();
      const body = buildMailBody();

      // Für Nicht-Firefox: PDF im selben Klick erzeugen
      if (!isFirefox && btnPdf) {
        btnPdf.click();
      }

      if (isAndroid && !isFirefox) {
        // Android‑Intent vermeidet %0D%0A-Probleme in vielen Mail-Apps
        const intentUrl =
          "intent:mailto:?subject=" +
          encodeURIComponent(subject) +
          "&body=" +
          encodeURIComponent(body) +
          "#Intent;scheme=mailto;end";
        window.location.href = intentUrl;
      } else {
        // Fallback: klassischer mailto-Link
        const mailto =
          "mailto:?subject=" +
          encodeURIComponent(subject) +
          "&body=" +
          encodeURIComponent(body);
        window.location.href = mailto;
      }
    } catch (e) {
      console.error(e);
    }
  });
});

function buildMailSubject() {
  const name = document.getElementById("name")?.value.trim() || "";
  const projekt = document.getElementById("projekt")?.value.trim() || "";
  const base = "Reisekostenvorschuss";

  // Subject format: Name_Projekt/Auftrag Nr._Reisekostenvorschuss
  const parts = [name, projekt, base].filter(Boolean);
  return parts.length ? parts.join("_") : base;
}

// Kurzform, Variante A
function buildMailBody() {
  const projekt = document.getElementById("projekt")?.value || "";

  const name = get("name");
  const personalnr = get("personalnr");
  const projekt = get("auftrag");
  const anreise = get("anreisetag");
  const rueckreise = get("rueckreisetag");
  const ort = get("ort");
  const datum = get("datum");

  return (
    "Sehr geehrte Damen und Herren,\n\n" +
    "anbei übersende ich den ausgefüllten Reisekostenvorschuss.\n\n" +
    "Mitarbeiter- & Auftragsdaten\n" +
    `Name: ${name}\n` +
    `Personalnummer: ${personalnr}\n` +
    `Projekt / Auftrags-Nr.: ${projekt}\n\n` +
    "Reisezeit\n" +
    `Anreisetag: ${anreise}\n` +
    `Rückreisetag: ${rueckreise}\n\n` +
    "Ort, Datum\n" +
    `Ort: ${ort}\n` +
    `Datum: ${datum}\n\n` +
    "Mit freundlichen Grüßen\n" +
    `${name}`
  );
}
