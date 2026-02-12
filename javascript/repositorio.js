// Configuração da planilha do Google Sheets
// -------------------------------------------------------------
// 1. No Google Sheets, defina o compartilhamento como
//    "Qualquer pessoa com o link pode visualizar".
// 2. Copie o ID da planilha a partir da URL:
//    https://docs.google.com/spreadsheets/d/SEU_ID_AQUI/edit
// 3. Atualize as constantes abaixo com o ID e o nome da aba.

const SPREADSHEET_ID = "1WREleFc-FAj-4w1RiWwNEsgB_ZNbmjShe4377HoXx5g";
const SHEET_NAME = "Projetos"; // nome da aba onde estão os dados

// Nome das abas dentro da planilha principal
const SHEETS = {
  projetos: "Projetos",
  calendario: "Calendario",
  orientadores: "Orientadores",
};

// Endpoint no formato JSON (Google Visualization API)
const SHEET_GVIZ_URL =
  "https://docs.google.com/spreadsheets/d/" +
  SPREADSHEET_ID +
  "/gviz/tq?sheet=" +
  encodeURIComponent(SHEET_NAME);

let allProjects = [];
let allCalendarEvents = [];
let allAdvisors = [];

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("repository-page")) {
    initRepositoryPage();
  } else if (document.getElementById("project-detail-page")) {
    initProjectDetailPage();
  } else if (document.getElementById("calendar-page")) {
    initCalendarPage();
  } else if (document.getElementById("advisors-page")) {
    initAdvisorsPage();
  }
});

// Busca genérica de linhas em uma aba da planilha
async function fetchSheetRows(sheetName) {
  const url =
    "https://docs.google.com/spreadsheets/d/" +
    SPREADSHEET_ID +
    "/gviz/tq?sheet=" +
    encodeURIComponent(sheetName)  +
    "&headers=1";

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Não foi possível carregar os dados da planilha.");
  }

  const text = await response.text();

  // A resposta vem como: google.visualization.Query.setResponse(...)
  const jsonText = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const json = JSON.parse(jsonText);

  const cols = json.table.cols.map((c) => c.label || c.id);

  return json.table.rows.map((row) => {
    const obj = {};
    row.c.forEach((cell, idx) => {
      const key = cols[idx] || `col_${idx}`;
      obj[key] = cell && typeof cell.v !== "undefined" ? cell.v : "";
    });
    return obj;
  });
}

async function fetchProjects() {
  if (allProjects.length) {
    return allProjects;
  }

  const rawRows = await fetchSheetRows(SHEETS.projetos);
  const projects = rawRows.map((row) => normalizeProject(row));

  // Mantém apenas linhas que têm um ID definido
  allProjects = projects.filter((p) => p.id);
  return allProjects;
}

// Normaliza os nomes das colunas da planilha em um objeto consistente
// Nomes esperados (cabeçalhos da planilha, podem ser ajustados conforme necessidade):
// ID, Ano, Semestre, Autor, Título, Orientador, Coorientador,
// Curso, Data de defesa, Banca / Avaliadores, Palavras-chave,
// Resumo, Link PDF, Link Outros Materiais, Licença
function normalizeProject(raw) {
  const get = (...keys) => {
    for (const key of keys) {
      if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== "") {
        return String(raw[key]).trim();
      }
    }
    return "";
  };

  return {
    id: get("ID", "Id", "id"),
    ano: get("Ano", "ANO", "ano"),
    semestre: get("Semestre", "semestre"),
    autor: get("Autor", "Autores", "Autor(es)", "autor"),
    titulo: get("Título", "Titulo", "TITULO", "titulo"),
    orientador: get("Orientador", "orientador"),
    coorientador: get("Coorientador", "coorientador"),
    curso: get("Curso", "curso"),
    dataDefesa: get("Data de defesa", "Data", "data"),
    banca: get("Banca / Avaliadores", "Banca", "banca"),
    palavrasChave: get("Palavras-chave", "Palavras chave", "palavras-chave", "palavrasChave"),
    resumo: get("Resumo", "RESUMO", "resumo"),
    linkPdf: get("Link PDF", "PDF", "Link", "link"),
    linkOutros: get("Link Outros Materiais", "Outros materiais", "outros"),
    licenca: get("Licença", "Licenca", "licenca"),
    imagem: get("Link Imagem", "Imagem", "Image"),
  };
}

// ---------------------- PÁGINA DO REPOSITÓRIO ----------------------

async function initRepositoryPage() {
  const loadingEl = document.getElementById("repository-loading");
  const errorEl = document.getElementById("repository-error");
  const emptyEl = document.getElementById("repository-empty");

  try {
    const projects = await fetchProjects();
    loadingEl.hidden = true;

    if (!projects.length) {
      emptyEl.hidden = false;
      return;
    }

    populateFilters(projects);
    renderProjectList(projects);
    setupFilterEvents(projects);
  } catch (error) {
    console.error(error);
    loadingEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent =
      "Ocorreu um erro ao carregar o repositório. Verifique a configuração da planilha e tente novamente.";
  }
}

function populateFilters(projects) {
  const yearSelect = document.getElementById("year-filter");
  const authorSelect = document.getElementById("author-filter");
  const advisorSelect = document.getElementById("advisor-filter");

  const years = Array.from(
    new Set(projects.map((p) => p.ano).filter((v) => v))
  ).sort((a, b) => b.localeCompare(a));

  const authors = Array.from(
    new Set(projects.map((p) => p.autor).filter((v) => v))
  ).sort((a, b) => a.localeCompare(b));

  const advisors = Array.from(
    new Set(projects.map((p) => p.orientador).filter((v) => v))
  ).sort((a, b) => a.localeCompare(b));

  for (const year of years) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  }

  for (const author of authors) {
    const option = document.createElement("option");
    option.value = author;
    option.textContent = author;
    authorSelect.appendChild(option);
  }

  for (const advisor of advisors) {
    const option = document.createElement("option");
    option.value = advisor;
    option.textContent = advisor;
    advisorSelect.appendChild(option);
  }
}

function setupFilterEvents(projects) {
  const searchInput = document.getElementById("search-input");
  const yearSelect = document.getElementById("year-filter");
  const authorSelect = document.getElementById("author-filter");
  const advisorSelect = document.getElementById("advisor-filter");

  const applyFilters = () => {
    const term = searchInput.value.toLowerCase().trim();
    const year = yearSelect.value;
    const author = authorSelect.value;
    const advisor = advisorSelect.value;

    const filtered = projects.filter((p) => {
      if (year && p.ano !== year) return false;
      if (author && p.autor !== author) return false;
      if (advisor && p.orientador !== advisor) return false;

      if (term) {
        const haystack = [
          p.titulo,
          p.autor,
          p.orientador,
          p.palavrasChave,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      return true;
    });

    const emptyEl = document.getElementById("repository-empty");
    emptyEl.hidden = filtered.length > 0;

    renderProjectList(filtered);
  };

  searchInput.addEventListener("input", applyFilters);
  yearSelect.addEventListener("change", applyFilters);
  authorSelect.addEventListener("change", applyFilters);
  advisorSelect.addEventListener("change", applyFilters);
}

function renderProjectList(projects) {
  const container = document.getElementById("repository-results");
  container.innerHTML = "";

  if (!projects.length) {
    return;
  }

  // Ordena por ano (desc) e, dentro do ano, por título
  const sorted = [...projects].sort((a, b) => {
    if (a.ano === b.ano) {
      return a.titulo.localeCompare(b.titulo);
    }
    return b.ano.localeCompare(a.ano);
  });

  let currentYear = null;

  for (const project of sorted) {
    if (project.ano && project.ano !== currentYear) {
      currentYear = project.ano;
      const yearHeading = document.createElement("h2");
      yearHeading.className = "repository-year-heading";
      yearHeading.textContent = currentYear;
      container.appendChild(yearHeading);
    }

    const card = document.createElement("article");
    card.className = "project-card";

    const titleLink = document.createElement("a");
    titleLink.href = `projeto.html?id=${encodeURIComponent(project.id)}`;
    titleLink.className = "project-title-link";
    titleLink.textContent = project.titulo || "(Sem título)";

    const titleEl = document.createElement("h3");
    titleEl.className = "project-card-title";
    titleEl.appendChild(titleLink);

    const metaEl = document.createElement("p");
    metaEl.className = "project-card-meta";
    const partesMeta = [];
    if (project.autor) partesMeta.push(`Autor(a): ${project.autor}`);
    if (project.orientador) partesMeta.push(`Orientador(a): ${project.orientador}`);
    if (project.semestre || project.ano) {
      const periodo = [project.ano, project.semestre]
        .filter((v) => v)
        .join(" - ");
      partesMeta.push(`Período: ${periodo}`);
    }
    metaEl.textContent = partesMeta.join(" | ");

    const keywordsEl = document.createElement("p");
    keywordsEl.className = "project-card-keywords";
    if (project.palavrasChave) {
      keywordsEl.textContent = `Palavras-chave: ${project.palavrasChave}`;
    }

    const actionsEl = document.createElement("div");
    actionsEl.className = "project-card-actions";

    const detailsLink = document.createElement("a");
    detailsLink.href = `projeto.html?id=${encodeURIComponent(project.id)}`;
    detailsLink.className = "project-card-button";
    detailsLink.textContent = "Ver detalhes";
    actionsEl.appendChild(detailsLink);

    if (project.linkPdf) {
      const pdfLink = document.createElement("a");
      pdfLink.href = project.linkPdf;
      pdfLink.target = "_blank";
      pdfLink.rel = "noopener noreferrer";
      pdfLink.className = "project-card-button project-card-button-secondary";
      pdfLink.textContent = "Baixar PDF";
      actionsEl.appendChild(pdfLink);
    }

    card.appendChild(titleEl);
    card.appendChild(metaEl);
    if (project.palavrasChave) {
      card.appendChild(keywordsEl);
    }
    card.appendChild(actionsEl);

    container.appendChild(card);
  }
}

// ---------------------- PÁGINA DE DETALHE ----------------------

async function initProjectDetailPage() {
  const loadingEl = document.getElementById("project-loading");
  const errorEl = document.getElementById("project-error");
  const contentEl = document.getElementById("project-content");

  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("id");

  if (!projectId) {
    loadingEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent =
      "Nenhum identificador de trabalho foi informado. Volte ao repositório e selecione um trabalho.";
    return;
  }

  try {
    const projects = await fetchProjects();
    const project = projects.find((p) => p.id === projectId);

    loadingEl.hidden = true;

    if (!project) {
      errorEl.hidden = false;
      errorEl.textContent =
        "Não foi possível encontrar este trabalho. Verifique se o link está correto ou volte ao repositório.";
      return;
    }

    fillProjectDetail(project);
    contentEl.hidden = false;
  } catch (error) {
    console.error(error);
    loadingEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent =
      "Ocorreu um erro ao carregar os dados do trabalho. Verifique a configuração da planilha e tente novamente.";
  }
}

function fillProjectDetail(project) {
  const titleEl = document.getElementById("project-title");
  const authorEl = document.getElementById("project-author");
  const advisorsEl = document.getElementById("project-advisors");
  const bancaEl = document.getElementById("project-banca");
  const extraMetaEl = document.getElementById("project-extra-meta");
  const keywordsEl = document.getElementById("project-keywords");
  const abstractEl = document.getElementById("project-abstract");
  const linksEl = document.getElementById("project-links");
  const imageWrapper = document.getElementById("project-image-wrapper");

  titleEl.textContent = project.titulo || "Trabalho sem título";

  // Limpa campos
  authorEl.textContent = "";
  advisorsEl.textContent = "";
  bancaEl.textContent = "";
  extraMetaEl.textContent = "";
  keywordsEl.textContent = "";
  imageWrapper.innerHTML = "";

  // Autor(a)
  if (project.autor) {
    const strong = document.createElement("strong");
    strong.textContent = "Autor(a): ";
    authorEl.appendChild(strong);
    authorEl.appendChild(document.createTextNode(project.autor));
  } else {
    authorEl.style.display = "none";
  }

  // Orientador(a) e coorientador(a)
  const advisorParts = [];
  if (project.orientador) {
    advisorParts.push({ label: "Orientador(a): ", value: project.orientador });
  }
  if (project.coorientador) {
    advisorParts.push({ label: "Coorientador(a): ", value: project.coorientador });
  }
  if (advisorParts.length) {
    advisorsEl.textContent = "";
    advisorParts.forEach((item, index) => {
      if (index > 0) {
        advisorsEl.appendChild(document.createTextNode(" | "));
      }
      const strong = document.createElement("strong");
      strong.textContent = item.label;
      advisorsEl.appendChild(strong);
      advisorsEl.appendChild(document.createTextNode(item.value));
    });
  } else {
    advisorsEl.style.display = "none";
  }

  // Banca
  if (project.banca) {
    const strong = document.createElement("strong");
    strong.textContent = "Banca: ";
    bancaEl.appendChild(strong);
    bancaEl.appendChild(document.createTextNode(project.banca));
  } else {
    bancaEl.style.display = "none";
  }

  // Outras informações (curso, período, data, licença)
  const extraParts = [];
  if (project.curso) extraParts.push(`Curso: ${project.curso}`);
  if (project.ano || project.semestre) {
    const periodo = [project.ano, project.semestre].filter((v) => v).join(" - ");
    extraParts.push(`Período: ${periodo}`);
  }
  if (project.dataDefesa) extraParts.push(`Data da defesa: ${project.dataDefesa}`);
  if (project.licenca) extraParts.push(`Licença: ${project.licenca}`);
  if (extraParts.length) {
    extraMetaEl.textContent = extraParts.join(" | ");
  } else {
    extraMetaEl.style.display = "none";
  }

  // Palavras-chave
  if (project.palavrasChave) {
    keywordsEl.textContent = `Palavras-chave: ${project.palavrasChave}`;
  }

  // Resumo
  abstractEl.textContent =
    project.resumo ||
    "Resumo não informado. Entre em contato com a coordenação para mais informações.";

  // Imagem do projeto (opcional)
if (project.imagem) {
  let imageUrl = project.imagem;
  
  // Convert Google Drive link to direct image URL
  if (imageUrl.includes("drive.google.com")) {
    const fileIdMatch = imageUrl.match(/\/d\/(.*?)(\/|$)/);
    if (fileIdMatch) {
      const fileId = fileIdMatch[1];
      // Use Google's embedding service instead
      imageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }
  
  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = `Imagem ilustrativa do trabalho: ${project.titulo || ""}`;
  imageWrapper.appendChild(img);
}

  // Links
  linksEl.innerHTML = "";

  if (project.linkPdf) {
    const pdfLink = document.createElement("a");
    pdfLink.href = project.linkPdf;
    pdfLink.target = "_blank";
    pdfLink.rel = "noopener noreferrer";
    pdfLink.className = "project-card-button";
    pdfLink.textContent = "Baixar PDF do trabalho";
    linksEl.appendChild(pdfLink);
  }

  if (project.linkOutros) {
    const outrosLink = document.createElement("a");
    outrosLink.href = project.linkOutros;
    outrosLink.target = "_blank";
    outrosLink.rel = "noopener noreferrer";
    outrosLink.className = "project-card-button project-card-button-secondary";
    outrosLink.textContent = "Outros materiais";
    linksEl.appendChild(outrosLink);
  }
}

// ---------------------- CALENDÁRIO ----------------------

function normalizeCalendarEvent(raw) {
  const get = (...keys) => {
    for (const key of keys) {
      if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== "") {
        return String(raw[key]).trim();
      }
    }
    return "";
  };

  return {
    ano: get("Ano", "ano"),
    semestre: get("Semestre", "semestre"),
    data: get("Data", "data"),
    tipo: get("Tipo", "tipo"),
    atividade: get("Atividade", "Título", "Titulo"),
    descricao: get("Descrição", "Descricao", "descrição"),
  };
}

async function fetchCalendarEvents() {
  if (allCalendarEvents.length) {
    return allCalendarEvents;
  }

  const rawRows = await fetchSheetRows(SHEETS.calendario);
  const events = rawRows.map((row) => normalizeCalendarEvent(row));

  // Mantém apenas linhas que têm pelo menos ano e data preenchidos
  allCalendarEvents = events.filter((e) => e.ano && e.data);
  return allCalendarEvents;
}

async function initCalendarPage() {
  const loadingEl = document.getElementById("calendar-loading");
  const errorEl = document.getElementById("calendar-error");
  const emptyEl = document.getElementById("calendar-empty");

  try {
    const events = await fetchCalendarEvents();
    loadingEl.hidden = true;

    if (!events.length) {
      emptyEl.hidden = false;
      return;
    }

    renderCalendar(events);
  } catch (error) {
    console.error(error);
    loadingEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent =
      "Ocorreu um erro ao carregar o calendário. Verifique a configuração da planilha e tente novamente.";
  }
}

function renderCalendar(events) {
  const container = document.getElementById("calendar-table-body");
  container.innerHTML = "";

  if (!events.length) {
    return;
  }

  const sorted = [...events].sort((a, b) => {
    if (a.ano === b.ano) {
      if (a.semestre === b.semestre) {
        return a.data.localeCompare(b.data);
      }
      return String(a.semestre).localeCompare(String(b.semestre));
    }
    return b.ano.localeCompare(a.ano);
  });

  let currentGroup = "";

  for (const ev of sorted) {
    const groupLabel = ev.semestre ? `${ev.ano} - ${ev.semestre}º semestre` : ev.ano;
    if (groupLabel !== currentGroup) {
      currentGroup = groupLabel;
      const groupRow = document.createElement("tr");
      groupRow.className = "calendar-group-row";
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = groupLabel;
      groupRow.appendChild(cell);
      container.appendChild(groupRow);
    }

    const row = document.createElement("tr");

    const dataTd = document.createElement("td");
    dataTd.textContent = ev.data;
    row.appendChild(dataTd);

    const tipoTd = document.createElement("td");
    tipoTd.textContent = ev.tipo;
    row.appendChild(tipoTd);

    const atvTd = document.createElement("td");
    atvTd.textContent = ev.atividade;
    row.appendChild(atvTd);

    const descTd = document.createElement("td");
    descTd.textContent = ev.descricao;
    row.appendChild(descTd);

    container.appendChild(row);
  }
}

// ---------------------- ORIENTADORES ----------------------

function normalizeAdvisor(raw) {
  const get = (...keys) => {
    for (const key of keys) {
      if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== "") {
        return String(raw[key]).trim();
      }
    }
    return "";
  };

  return {
    id: Math.random(), // Generate a simple ID since there's no ID column
    nome: get("Nome"),
    lattes: get("Lattes"),
    email: get("Email"),
    areas: get("Áreas de atuação"),
    palavrasChave: get("Palavras-chave"),
    disponibilidade: get("Disponibilidade"),
    observacoes: get("Observações"),
  };
}

async function fetchAdvisors() {
  console.log("fetchAdvisors called, allAdvisors.length:", allAdvisors.length);
  
  if (allAdvisors.length) {
    console.log("Returning cached advisors");
    return allAdvisors;
  }

  console.log("Fetching from sheet:", SHEETS.orientadores);
  const rawRows = await fetchSheetRows(SHEETS.orientadores);
  console.log("Raw rows:", rawRows);
  
  const advisors = rawRows.map((row) => normalizeAdvisor(row));
  console.log("Normalized advisors:", advisors);

  allAdvisors = advisors.filter((a) => a.nome);
  console.log("Filtered advisors (with nome):", allAdvisors);
  
  return allAdvisors;
}

// Add this right after the fetchAdvisors function

async function initAdvisorsPage() {
  const loadingEl = document.getElementById("advisors-loading");
  const errorEl = document.getElementById("advisors-error");
  const emptyEl = document.getElementById("advisors-empty");

  try {
    console.log("Starting to fetch advisors...");
    const rawRows = await fetchSheetRows(SHEETS.orientadores);
    console.log("Raw rows from sheet:", rawRows);
    
    const advisors = await fetchAdvisors();
    console.log("Processed advisors:", advisors);
    
    loadingEl.hidden = true;

    if (!advisors.length) {
      console.warn("No advisors found after filtering");
      emptyEl.hidden = false;
      return;
    }

    console.log("Rendering", advisors.length, "advisors");
    renderAdvisorsList(advisors);
  } catch (error) {
    console.error("Error loading advisors:", error);
    loadingEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent =
      "Ocorreu um erro ao carregar a lista de orientadores. Verifique a configuração da planilha e tente novamente.";
  }
}

async function initAdvisorsPage() {
  const loadingEl = document.getElementById("advisors-loading");
  const errorEl = document.getElementById("advisors-error");
  const emptyEl = document.getElementById("advisors-empty");

  try {
    const advisors = await fetchAdvisors();
    loadingEl.hidden = true;

    if (!advisors.length) {
      emptyEl.hidden = false;
      return;
    }

    renderAdvisorsList(advisors);
  } catch (error) {
    console.error(error);
    loadingEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent =
      "Ocorreu um erro ao carregar a lista de orientadores. Verifique a configuração da planilha e tente novamente.";
  }
}

function renderAdvisorsList(advisors) {
  const container = document.getElementById("advisors-list");
  container.innerHTML = "";

  if (!advisors.length) {
    return;
  }

  const sorted = [...advisors].sort((a, b) => a.nome.localeCompare(b.nome));

  for (const adv of sorted) {
    const card = document.createElement("article");
    card.className = "advisor-card";

    const title = document.createElement("h3");
    title.className = "advisor-name";
    title.textContent = adv.nome;
    card.appendChild(title);

    if (adv.areas) {
      const areasP = document.createElement("p");
      areasP.className = "advisor-areas";
      areasP.textContent = `Áreas de orientação: ${adv.areas}`;
      card.appendChild(areasP);
    }

    if (adv.palavrasChave) {
      const kwP = document.createElement("p");
      kwP.className = "advisor-keywords";
      kwP.textContent = `Palavras-chave: ${adv.palavrasChave}`;
      card.appendChild(kwP);
    }

    const metaP = document.createElement("p");
    metaP.className = "advisor-meta";
    const metaParts = [];
    if (adv.disponibilidade) {
      metaParts.push(`Disponibilidade: ${adv.disponibilidade}`);
    }
    if (adv.observacoes) {
      metaParts.push(adv.observacoes);
    }
    metaP.textContent = metaParts.join(" | ");
    if (metaP.textContent) {
      card.appendChild(metaP);
    }

    const linksDiv = document.createElement("div");
    linksDiv.className = "advisor-links";

    if (adv.lattes) {
      const lattesLink = document.createElement("a");
      lattesLink.href = adv.lattes;
      lattesLink.target = "_blank";
      lattesLink.rel = "noopener noreferrer";
      lattesLink.textContent = "Currículo Lattes";
      linksDiv.appendChild(lattesLink);
    }

    if (adv.email) {
      const emailLink = document.createElement("a");
      emailLink.href = `mailto:${adv.email}`;
      emailLink.textContent = adv.email;
      linksDiv.appendChild(emailLink);
    }

    if (linksDiv.children.length > 0) {
      card.appendChild(linksDiv);
    }

    container.appendChild(card);
  }
}

