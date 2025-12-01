import Chart from 'chart.js/auto';

interface DashboardData {
  labels: string[];
  values: number[];
  latest: StockRecord[];
  stats: {
    totalMaterials: number;
    totalRecords: number;
    totalEntradas: number;
    totalSaidas: number;
    lowStock: number;
  };
}

interface StockRecord {
  id: number;
  material: string;
  quantity: number;
  unit?: string;
  type?: string;
  location: string;
  message: string;
  timestamp: string;
}

interface MaterialSummary {
  id: number;
  material: string;
  total: number;
  unit: string;
  min_stock: number;
  max_stock: number | null;
  last_update: string;
  status: 'baixo' | 'normal' | 'alto';
  description?: string;
}

let chartInstance: Chart | null = null;

async function fetchDashboardData(): Promise<DashboardData> {
  const response = await fetch('/api/dashboard-data');
  if (!response.ok) {
    throw new Error('Falha ao carregar dados');
  }
  return response.json();
}

async function fetchRecords(): Promise<StockRecord[]> {
  const response = await fetch('/api/records');
  if (!response.ok) {
    throw new Error('Falha ao carregar registros');
  }
  return response.json();
}

async function fetchMateriais(): Promise<MaterialSummary[]> {
  const response = await fetch('/api/materiais');
  if (!response.ok) {
    throw new Error('Falha ao carregar materiais');
  }
  return response.json();
}

let dashboardChartInstance: Chart | null = null;
let entradaSaidaChartInstance: Chart | null = null;
let distribuicaoChartInstance: Chart | null = null;

function renderChart(labels: string[], values: number[], canvasId: string = 'chartCanvas'): void {
  console.log('renderChart chamado com:', { labels, values, canvasId });
  
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas não encontrado:', canvasId);
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Contexto 2D não disponível!');
    return;
  }

  // Destruir instância anterior baseado no canvas
  if (canvasId === 'chartCanvas' && chartInstance) {
    chartInstance.destroy();
  } else if (canvasId === 'dashboardChartCanvas' && dashboardChartInstance) {
    dashboardChartInstance.destroy();
  }

  // Filtrar e preparar dados (remover valores negativos ou zero)
  const filteredData = labels
    .map((label, index) => ({ label, value: values[index] }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const filteredLabels = filteredData.map(item => item.label);
  const filteredValues = filteredData.map(item => item.value);

  console.log('Dados filtrados:', { filteredLabels, filteredValues });

  console.log('Criando novo gráfico...');
  const newChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: filteredLabels,
      datasets: [
        {
          label: 'Quantidade em Estoque',
          data: filteredValues,
          backgroundColor: 'rgba(102, 126, 234, 0.7)',
          borderColor: 'rgba(102, 126, 234, 1)',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Estoque: ${(context.parsed.y || 0).toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value.toLocaleString('pt-BR');
            }
          }
        },
      },
    },
  });

  if (canvasId === 'chartCanvas') {
    chartInstance = newChart;
  } else if (canvasId === 'dashboardChartCanvas') {
    dashboardChartInstance = newChart;
  }
  
  console.log('Gráfico criado com sucesso!');
}

function renderTable(records: StockRecord[], containerId: string = 'tableContainer', limit?: number): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const displayRecords = limit ? records.slice(0, limit) : records;

  if (displayRecords.length === 0) {
    container.innerHTML = '<p class="text-muted">Nenhum registro disponível.</p>';
    return;
  }

  // Layout especial para a aba de novo registro
  if (containerId === 'novoRegistrosContainer') {
    container.innerHTML = `
      <div class="recent-records">
        ${displayRecords
          .map((r) => {
            const displayQuantity = Math.abs(r.quantity);
            const isEntrada = r.type === 'entrada';
            const date = new Date(r.timestamp);
            const timeAgo = getTimeAgo(date);
            
            return `
              <div class="recent-record-item">
                <div class="recent-record-icon ${isEntrada ? 'entrada' : 'saida'}">
                  ${isEntrada ? '➕' : '➖'}
                </div>
                <div class="recent-record-content">
                  <div class="recent-record-header">
                    <strong>${escapeHtml(r.material)}</strong>
                    <span class="recent-record-time">${timeAgo}</span>
                  </div>
                  <div class="recent-record-details">
                    <span class="badge ${isEntrada ? 'badge-entrada' : 'badge-saida'}">${r.type || 'entrada'}</span>
                    <span class="recent-record-qty">${displayQuantity} ${r.unit || 'un'}</span>
                    ${r.location ? `<span class="recent-record-location">📍 ${escapeHtml(r.location)}</span>` : ''}
                  </div>
                  ${r.message ? `<div class="recent-record-message">${escapeHtml(r.message)}</div>` : ''}
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
    return;
  }

  // Layout padrão de tabela para outras abas
  const table = document.createElement('table');
  table.className = 'table table-hover';
  table.innerHTML = `
    <thead class="table-light">
      <tr>
        <th>Data</th>
        <th>Material</th>
        <th>Tipo</th>
        <th>Quantidade</th>
        <th>Local</th>
        <th>Observações</th>
      </tr>
    </thead>
    <tbody>
      ${displayRecords
        .map(
          (r) => {
            const displayQuantity = Math.abs(r.quantity);
            return `
        <tr>
          <td>${new Date(r.timestamp).toLocaleString('pt-BR')}</td>
          <td><strong>${escapeHtml(r.material)}</strong></td>
          <td><span class="badge ${r.type === 'entrada' ? 'badge-entrada' : 'badge-saida'}">${r.type || 'entrada'}</span></td>
          <td>${displayQuantity} ${r.unit || 'un'}</td>
          <td>${escapeHtml(r.location || '-')}</td>
          <td>${escapeHtml(r.message || '-')}</td>
        </tr>
      `;
          }
        )
        .join('')}
    </tbody>
  `;

  container.innerHTML = '';
  container.appendChild(table);
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins}min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays}d atrás`;
  return date.toLocaleDateString('pt-BR');
}

function renderSummary(records: StockRecord[], containerId: string = 'summaryContainer'): void {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Container não encontrado:', containerId);
    return;
  }

  // Calcular estoque atual (soma direta, pois saídas já são negativas)
  const summary: { [key: string]: number } = {};
  records.forEach((r) => {
    summary[r.material] = (summary[r.material] || 0) + r.quantity;
  });

  const sortedMaterials = Object.entries(summary).sort((a, b) => b[1] - a[1]);

  if (sortedMaterials.length === 0) {
    container.innerHTML = '<p class="text-muted small">Nenhum material registrado.</p>';
    return;
  }

  container.innerHTML = `
    <div class="list-group list-group-flush" style="max-height: 400px; overflow-y: auto;">
      ${sortedMaterials
        .map(
          ([material, qty]) => `
        <div class="list-group-item d-flex justify-content-between align-items-center px-0">
          <span class="small">${escapeHtml(material)}</span>
          <span class="badge ${qty >= 0 ? 'bg-success' : 'bg-danger'} rounded-pill">${qty.toFixed(2)}</span>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

function renderSummaryFromMaterials(materiais: MaterialSummary[], containerId: string): void {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Container não encontrado:', containerId);
    return;
  }

  if (materiais.length === 0) {
    container.innerHTML = '<p class="text-muted small">Nenhum material registrado.</p>';
    return;
  }

  // Ordenar por quantidade (maior para menor)
  const sortedMaterials = [...materiais].sort((a, b) => b.total - a.total);

  container.innerHTML = `
    <div class="list-group list-group-flush" style="max-height: 400px; overflow-y: auto;">
      ${sortedMaterials
        .map((m) => {
          let badgeClass = 'bg-success';
          if (m.status === 'baixo') {
            badgeClass = 'bg-danger';
          } else if (m.status === 'alto') {
            badgeClass = 'bg-warning text-dark';
          } else if (m.total <= 0) {
            badgeClass = 'bg-secondary';
          }
          
          return `
            <div class="list-group-item d-flex justify-content-between align-items-center px-0">
              <span class="small">${escapeHtml(m.material)}</span>
              <span class="badge ${badgeClass} rounded-pill">${m.total.toFixed(2)} ${escapeHtml(m.unit)}</span>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function updateStats(records: StockRecord[]): void {
  const materials = new Set(records.map((r) => r.material));
  const entradas = records.filter((r) => r.type === 'entrada').length;
  const saidas = records.filter((r) => r.type === 'saida').length;

  const totalMateriaisEl = document.getElementById('totalMateriais');
  const totalRegistrosEl = document.getElementById('totalRegistros');
  const totalEntradasEl = document.getElementById('totalEntradas');
  const totalSaidasEl = document.getElementById('totalSaidas');

  if (totalMateriaisEl) totalMateriaisEl.textContent = materials.size.toString();
  if (totalRegistrosEl) totalRegistrosEl.textContent = records.length.toString();
  if (totalEntradasEl) totalEntradasEl.textContent = entradas.toString();
  if (totalSaidasEl) totalSaidasEl.textContent = saidas.toString();
}

function renderEntradaSaidaChart(records: StockRecord[]): void {
  const canvas = document.getElementById('entradaSaidaChart') as HTMLCanvasElement;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (entradaSaidaChartInstance) {
    entradaSaidaChartInstance.destroy();
  }

  const entradas = records.filter(r => r.type === 'entrada').length;
  const saidas = records.filter(r => r.type === 'saida').length;
  const total = entradas + saidas;

  entradaSaidaChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [
        `Entradas: ${entradas}`,
        `Saídas: ${saidas}`
      ],
      datasets: [{
        data: [entradas, saidas],
        backgroundColor: [
          'rgba(16, 185, 129, 0.8)',
          'rgba(239, 68, 68, 0.8)'
        ],
        borderColor: [
          'rgba(16, 185, 129, 1)',
          'rgba(239, 68, 68, 1)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: {
              size: 12
            },
            padding: 15,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label?.split(':')[0] || '';
              const value = context.parsed || 0;
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function renderDistribuicaoChart(records: StockRecord[]): void {
  const canvas = document.getElementById('distribuicaoChart') as HTMLCanvasElement;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (distribuicaoChartInstance) {
    distribuicaoChartInstance.destroy();
  }

  // Calcular estoque atual por material (soma considerando negativos)
  const summary: { [key: string]: number } = {};
  records.forEach((r) => {
    // Se quantity já é negativo (saída), usa direto
    // Se é positivo (entrada), usa direto
    summary[r.material] = (summary[r.material] || 0) + r.quantity;
  });

  // Filtrar apenas materiais com estoque positivo
  const materialsWithStock = Object.entries(summary)
    .filter(([_, qty]) => qty > 0)
    .sort((a, b) => b[1] - a[1]);

  const materials = materialsWithStock.map(([material]) => material);
  const quantities = materialsWithStock.map(([_, qty]) => qty);

  if (materials.length === 0) {
    // Se não houver materiais, mostrar mensagem
    const parent = canvas.parentElement;
    if (parent) {
      parent.innerHTML = '<p class="text-muted text-center">Nenhum material em estoque</p>';
    }
    return;
  }

  // Criar labels com valores
  const labelsWithValues = materials.map((material, index) => {
    return `${material}: ${quantities[index].toFixed(2)}`;
  });

  // Cores variadas para o gráfico de pizza
  const colors = [
    'rgba(102, 126, 234, 0.8)',
    'rgba(118, 75, 162, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(59, 130, 246, 0.8)',
    'rgba(236, 72, 153, 0.8)',
    'rgba(34, 197, 94, 0.8)'
  ];

  distribuicaoChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labelsWithValues,
      datasets: [{
        data: quantities,
        backgroundColor: colors.slice(0, materials.length),
        borderColor: colors.slice(0, materials.length).map(c => c.replace('0.8', '1')),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: {
              size: 12
            },
            padding: 15,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = materials[context.dataIndex] || '';
              const value = context.parsed || 0;
              const total = quantities.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value.toFixed(2)} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderMateriaisList(materiais: MaterialSummary[]): void {
  const container = document.getElementById('materiaisListContainer');
  if (!container) return;

  if (materiais.length === 0) {
    container.innerHTML = '<p class="text-muted">Nenhum material registrado ainda.</p>';
    return;
  }

  // Ordenar por material
  const sortedMateriais = [...materiais].sort((a, b) => a.material.localeCompare(b.material));

  const table = document.createElement('table');
  table.className = 'table table-hover';
  table.innerHTML = `
    <thead class="table-light">
      <tr>
        <th>Material</th>
        <th>Estoque Atual</th>
        <th>Unidade</th>
        <th>Estoque Mínimo</th>
        <th>Última Atualização</th>
        <th>Status</th>
        <th style="width: 120px;">Ações</th>
      </tr>
    </thead>
    <tbody>
      ${sortedMateriais
        .map((m) => {
          // Status baseado no estoque mínimo
          let statusClass = 'bg-success';
          let statusText = '🟢 Normal';
          let statusIcon = '';
          
          if (m.status === 'baixo') {
            statusClass = 'bg-danger';
            statusText = '🔴 Baixo';
            statusIcon = ' ⚠️';
          } else if (m.status === 'alto') {
            statusClass = 'bg-warning';
            statusText = '🟡 Alto';
          } else if (m.total <= 0) {
            statusClass = 'bg-secondary';
            statusText = '⚫ Zerado';
            statusIcon = ' ⚠️';
          }
          
          const lastUpdate = m.last_update ? new Date(m.last_update).toLocaleString('pt-BR') : '-';
          
          return `
            <tr class="${m.status === 'baixo' || m.total <= 0 ? 'table-warning' : ''}">
              <td><strong>${escapeHtml(m.material)}${statusIcon}</strong></td>
              <td><span class="fs-5 fw-bold ${m.total <= m.min_stock ? 'text-danger' : ''}">${m.total.toFixed(2)}</span></td>
              <td>${escapeHtml(m.unit || 'un')}</td>
              <td><small class="text-muted">${m.min_stock || 0}</small></td>
              <td><small class="text-muted">${lastUpdate}</small></td>
              <td><span class="badge ${statusClass}">${statusText}</span></td>
              <td>
                <div class="action-buttons">
                  <button class="btn-action btn-edit" onclick="editarMaterial(${m.id})" title="Editar material">
                    ✏️
                  </button>
                  <button class="btn-action btn-delete" onclick="excluirMaterial(${m.id}, '${escapeHtml(m.material).replace(/'/g, "\\'")}')" title="Excluir material">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('')}
    </tbody>
  `;

  container.innerHTML = '';
  container.appendChild(table);
}

async function submitStock(event: Event): Promise<void> {
  event.preventDefault();

  const material = (document.getElementById('material') as HTMLInputElement).value.trim();
  const type = (document.getElementById('type') as HTMLSelectElement).value;
  const quantity = parseFloat((document.getElementById('quantity') as HTMLInputElement).value);
  const unit = (document.getElementById('unit') as HTMLSelectElement).value;
  const location = (document.getElementById('location') as HTMLInputElement).value;
  const message = (document.getElementById('message') as HTMLInputElement).value;

  try {
    const response = await fetch('/api/stock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        material,
        type,
        quantity: type === 'saida' ? -Math.abs(quantity) : Math.abs(quantity),
        unit,
        location,
        message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Mostrar mensagem de erro específica do backend
      alert(`❌ Erro: ${data.error || 'Não foi possível registrar a movimentação'}`);
      return;
    }

    if (!data.ok) {
      // Caso o backend retorne ok: false
      alert(`❌ Erro: ${data.error || 'Não foi possível registrar a movimentação'}`);
      return;
    }

    // Sucesso
    (document.getElementById('stockForm') as HTMLFormElement).reset();
    await loadData();
    alert('✅ Registro adicionado com sucesso!');
  } catch (error) {
    console.error('Erro:', error);
    alert('❌ Erro ao conectar com o servidor. Verifique sua conexão.');
  }
}

async function loadData(): Promise<void> {
  try {
    console.log('Carregando dados...');
    const [dashboardData, allRecords, materiais] = await Promise.all([
      fetchDashboardData(),
      fetchRecords(),
      fetchMateriais(),
    ]);

    console.log('Dados recebidos:', { dashboardData, allRecords, materiais });
    
    // Atualizar estatísticas usando os dados do dashboard
    if (dashboardData.stats) {
      const totalMateriaisEl = document.getElementById('totalMateriais');
      const totalRegistrosEl = document.getElementById('totalRegistros');
      const totalEntradasEl = document.getElementById('totalEntradas');
      const totalSaidasEl = document.getElementById('totalSaidas');

      if (totalMateriaisEl) totalMateriaisEl.textContent = dashboardData.stats.totalMaterials.toString();
      if (totalRegistrosEl) totalRegistrosEl.textContent = dashboardData.stats.totalRecords.toString();
      if (totalEntradasEl) totalEntradasEl.textContent = dashboardData.stats.totalEntradas.toString();
      if (totalSaidasEl) totalSaidasEl.textContent = dashboardData.stats.totalSaidas.toString();
    }
    
    // Renderizar no dashboard principal
    renderChart(dashboardData.labels, dashboardData.values, 'dashboardChartCanvas');
    renderTable(dashboardData.latest, 'dashboardTableContainer', 10);
    renderSummaryFromMaterials(materiais, 'dashboardSummaryContainer');
    renderEntradaSaidaChart(allRecords);
    renderDistribuicaoChart(allRecords);
    
    // Renderizar na aba de estoque
    renderChart(dashboardData.labels, dashboardData.values, 'chartCanvas');
    renderSummaryFromMaterials(materiais, 'summaryContainer');
    
    // Renderizar na aba de histórico (todas)
    allRecordsCache = allRecords; // Armazenar no cache para filtros
    renderTable(allRecords, 'tableContainer');
    
    // Renderizar lista de materiais na aba de novo registro
    renderMateriaisList(materiais);
    
    // Renderizar configurações de materiais
    renderConfigMateriais(materiais);
    
    console.log('Dados carregados com sucesso!');
  } catch (error) {
    const container = document.getElementById('tableContainer');
    if (container) {
      container.innerHTML =
        '<p class="text-danger">Erro ao carregar dados. Verifique se o servidor está rodando.</p>';
    }
    console.error('Erro ao carregar dados:', error);
  }
}

function setupSidebarNavigation(): void {
  console.log('Configurando navegação da sidebar...');
  
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  const sections = document.querySelectorAll('.section');
  
  console.log('Links encontrados:', sidebarLinks.length);
  console.log('Seções encontradas:', sections.length);
  
  // Função para mostrar uma seção específica
  const showSection = (sectionId: string) => {
    // Remove active de todos os links
    sidebarLinks.forEach(l => l.classList.remove('active'));
    
    // Adiciona active no link correspondente
    const activeLink = document.querySelector(`.sidebar-link[href="#${sectionId}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
    }
    
    // Esconde todas as seções com fade-out
    sections.forEach(section => {
      const htmlSection = section as HTMLElement;
      htmlSection.classList.remove('fade-in');
      htmlSection.classList.add('fade-out');
      
      // Aguardar animação antes de esconder
      setTimeout(() => {
        htmlSection.style.display = 'none';
      }, 200);
    });
    
    // Mostra apenas a seção solicitada com fade-in
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      // Pequeno delay para garantir que o fade-out terminou
      setTimeout(() => {
        targetSection.style.display = 'block';
        targetSection.classList.remove('fade-out');
        targetSection.classList.add('fade-in');
        console.log('Mostrando seção:', sectionId);
      }, 200);
      
      // Salvar no localStorage
      localStorage.setItem('lastActiveSection', sectionId);
      
      // Scroll suave para o topo
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      console.error('Seção não encontrada:', sectionId);
    }
  };
  
  // Restaurar última seção visitada ou mostrar dashboard
  const lastSection = localStorage.getItem('lastActiveSection') || 'dashboard';
  showSection(lastSection);
  
  // Adicionar event listeners nos links
  sidebarLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      const href = link.getAttribute('href');
      console.log('Link clicado:', href);
      
      if (href && href.startsWith('#')) {
        const sectionId = href.substring(1);
        showSection(sectionId);
      }
    });
  });
}

function renderConfigMateriais(materiais: any[]): void {
  const container = document.getElementById('configMateriaisContainer');
  if (!container) return;

  if (materiais.length === 0) {
    container.innerHTML = '<p class="text-muted">Nenhum material cadastrado ainda. Registre uma movimentação para criar materiais automaticamente.</p>';
    return;
  }

  // Ordenar por nome (material vem como 'material' do endpoint /api/materiais)
  const sortedMateriais = [...materiais].sort((a, b) => a.material.localeCompare(b.material));

  const table = document.createElement('table');
  table.className = 'table table-hover';
  table.innerHTML = `
    <thead class="table-light">
      <tr>
        <th style="width: 20%;">Material</th>
        <th style="width: 10%;">Unidade</th>
        <th style="width: 15%;">Estoque Atual</th>
        <th style="width: 15%;">Estoque Mínimo *</th>
        <th style="width: 15%;">Estoque Máximo</th>
        <th style="width: 10%;">Status Atual</th>
        <th style="width: 15%;">Ações</th>
      </tr>
    </thead>
    <tbody>
      ${sortedMateriais
        .map((m) => {
          // Determinar status atual
          let statusBadge = '<span class="badge bg-success">🟢 Normal</span>';
          let rowClass = '';
          
          if (m.status === 'baixo') {
            statusBadge = '<span class="badge bg-danger">🔴 Baixo</span>';
            rowClass = 'table-warning';
          } else if (m.status === 'alto') {
            statusBadge = '<span class="badge bg-warning text-dark">🟡 Alto</span>';
          } else if ((m.total || 0) <= 0) {
            statusBadge = '<span class="badge bg-secondary">⚫ Zerado</span>';
            rowClass = 'table-warning';
          }

          return `
            <tr data-material-id="${m.id}" class="${rowClass}">
              <td><strong>${escapeHtml(m.material)}</strong></td>
              <td>${escapeHtml(m.unit || 'un')}</td>
              <td>
                <span class="badge ${(m.total || 0) > 0 ? 'bg-info' : 'bg-secondary'}" style="font-size: 0.9rem;">
                  ${(m.total || 0).toFixed(2)}
                </span>
              </td>
              <td>
                <input type="number" 
                       class="form-control form-control-sm config-input" 
                       id="min_${m.id}" 
                       value="${m.min_stock || 0}" 
                       min="0" 
                       step="0.01"
                       required>
              </td>
              <td>
                <input type="number" 
                       class="form-control form-control-sm config-input" 
                       id="max_${m.id}" 
                       value="${m.max_stock || ''}" 
                       min="0" 
                       step="0.01"
                       placeholder="Opcional">
              </td>
              <td>${statusBadge}</td>
              <td>
                <div class="action-buttons">
                  <button class="btn-action btn-save" onclick="salvarConfigMaterial(${m.id})" title="Salvar configuração">
                    💾
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('')}
    </tbody>
  `;

  container.innerHTML = '';
  container.appendChild(table);
  
  // Adicionar nota de rodapé
  const note = document.createElement('div');
  note.className = 'mt-3';
  note.innerHTML = '<small class="text-muted">* Campo obrigatório. O estoque máximo é opcional.</small>';
  container.appendChild(note);
}

async function salvarConfigMaterial(materialId: number): Promise<void> {
  const minInput = document.getElementById(`min_${materialId}`) as HTMLInputElement;
  const maxInput = document.getElementById(`max_${materialId}`) as HTMLInputElement;

  if (!minInput || !maxInput) return;

  const minStock = parseFloat(minInput.value) || 0;
  const maxStock = maxInput.value ? parseFloat(maxInput.value) : null;

  try {
    const response = await fetch(`/api/materials/${materialId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        min_stock: minStock,
        max_stock: maxStock,
      }),
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      alert('✅ Configuração salva com sucesso!');
      await loadData();
    } else {
      alert(`❌ Erro: ${data.error || 'Não foi possível salvar'}`);
    }
  } catch (error) {
    console.error('Erro:', error);
    alert('❌ Erro ao conectar com o servidor.');
  }
}

async function salvarTodasConfigs(): Promise<void> {
  const rows = document.querySelectorAll('#configMateriaisContainer tbody tr');
  
  if (rows.length === 0) {
    alert('⚠️ Nenhum material para configurar.');
    return;
  }

  const confirmacao = confirm(`Deseja salvar as configurações de ${rows.length} materiais?`);
  if (!confirmacao) return;

  let sucessos = 0;
  let erros = 0;
  const errosMensagens: string[] = [];

  for (const row of Array.from(rows)) {
    const materialId = parseInt(row.getAttribute('data-material-id') || '0');
    const minInput = document.getElementById(`min_${materialId}`) as HTMLInputElement;
    const maxInput = document.getElementById(`max_${materialId}`) as HTMLInputElement;

    if (!minInput || !maxInput) continue;

    const minStock = parseFloat(minInput.value) || 0;
    const maxStock = maxInput.value ? parseFloat(maxInput.value) : null;

    try {
      const response = await fetch(`/api/materials/${materialId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          min_stock: minStock,
          max_stock: maxStock,
        }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        sucessos++;
      } else {
        erros++;
        const materialName = row.querySelector('strong')?.textContent || `Material ${materialId}`;
        errosMensagens.push(`${materialName}: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      erros++;
      const materialName = row.querySelector('strong')?.textContent || `Material ${materialId}`;
      errosMensagens.push(`${materialName}: Erro de conexão`);
    }
  }

  // Mostrar resultado
  let mensagem = '';
  if (sucessos > 0) {
    mensagem += `✅ ${sucessos} material(is) configurado(s) com sucesso!\n`;
  }
  if (erros > 0) {
    mensagem += `\n❌ ${erros} erro(s):\n${errosMensagens.join('\n')}`;
  }

  alert(mensagem);
  
  // Recarregar dados
  await loadData();
}

// Variável global para armazenar todos os registros
let allRecordsCache: StockRecord[] = [];

function applyFilters(): void {
  const materialFilter = (document.getElementById('filterMaterial') as HTMLInputElement)?.value.toLowerCase() || '';
  const typeFilter = (document.getElementById('filterType') as HTMLSelectElement)?.value || '';
  const periodFilter = (document.getElementById('filterPeriod') as HTMLSelectElement)?.value || 'all';

  let filtered = [...allRecordsCache];

  // Filtrar por material
  if (materialFilter) {
    filtered = filtered.filter(r => r.material.toLowerCase().includes(materialFilter));
  }

  // Filtrar por tipo
  if (typeFilter) {
    filtered = filtered.filter(r => r.type === typeFilter);
  }

  // Filtrar por período
  if (periodFilter !== 'all') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    filtered = filtered.filter(r => {
      const recordDate = new Date(r.timestamp);
      
      switch (periodFilter) {
        case 'today':
          return recordDate >= today;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return recordDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return recordDate >= monthAgo;
        default:
          return true;
      }
    });
  }

  // Renderizar tabela filtrada
  renderTable(filtered, 'tableContainer');
  
  // Mostrar contador
  const container = document.getElementById('tableContainer');
  if (container && filtered.length < allRecordsCache.length) {
    const countDiv = document.createElement('div');
    countDiv.className = 'alert alert-info mt-3';
    countDiv.innerHTML = `📊 Mostrando ${filtered.length} de ${allRecordsCache.length} registros`;
    container.appendChild(countDiv);
  }
}

function clearFilters(): void {
  (document.getElementById('filterMaterial') as HTMLInputElement).value = '';
  (document.getElementById('filterType') as HTMLSelectElement).value = '';
  (document.getElementById('filterPeriod') as HTMLSelectElement).value = 'all';
  applyFilters();
}

function setupFilters(): void {
  const filterMaterial = document.getElementById('filterMaterial');
  const filterType = document.getElementById('filterType');
  const filterPeriod = document.getElementById('filterPeriod');

  if (filterMaterial) {
    filterMaterial.addEventListener('input', applyFilters);
  }
  if (filterType) {
    filterType.addEventListener('change', applyFilters);
  }
  if (filterPeriod) {
    filterPeriod.addEventListener('change', applyFilters);
  }
}

async function editarMaterial(materialId: number): Promise<void> {
  // Buscar dados do material
  const materiais = await fetchMateriais();
  const material = materiais.find(m => m.id === materialId);
  
  if (!material) {
    alert('❌ Material não encontrado!');
    return;
  }

  // Preencher modal com dados atuais
  (document.getElementById('editMaterialId') as HTMLInputElement).value = materialId.toString();
  (document.getElementById('editMaterialNome') as HTMLInputElement).value = material.material;
  (document.getElementById('editMaterialUnidade') as HTMLSelectElement).value = material.unit;
  (document.getElementById('editMaterialMin') as HTMLInputElement).value = material.min_stock.toString();
  (document.getElementById('editMaterialMax') as HTMLInputElement).value = material.max_stock?.toString() || '';
  (document.getElementById('editMaterialDescricao') as HTMLTextAreaElement).value = material.description || '';

  // Abrir modal
  const modal = new (window as any).bootstrap.Modal(document.getElementById('modalEditarMaterial'));
  modal.show();
}

async function salvarEdicaoMaterial(): Promise<void> {
  const materialId = parseInt((document.getElementById('editMaterialId') as HTMLInputElement).value);
  const nome = (document.getElementById('editMaterialNome') as HTMLInputElement).value;
  const unidade = (document.getElementById('editMaterialUnidade') as HTMLSelectElement).value;
  const min = (document.getElementById('editMaterialMin') as HTMLInputElement).value;
  const max = (document.getElementById('editMaterialMax') as HTMLInputElement).value;
  const descricao = (document.getElementById('editMaterialDescricao') as HTMLTextAreaElement).value;

  if (!nome || !unidade) {
    alert('❌ Nome e unidade são obrigatórios!');
    return;
  }

  try {
    const response = await fetch(`/api/materials/${materialId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: nome,
        unit: unidade,
        min_stock: parseFloat(min) || 0,
        max_stock: max ? parseFloat(max) : null,
        description: descricao || ''
      }),
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      // Fechar modal
      const modal = (window as any).bootstrap.Modal.getInstance(document.getElementById('modalEditarMaterial'));
      modal.hide();
      
      alert('✅ Material atualizado com sucesso!');
      await loadData();
    } else {
      alert(`❌ Erro: ${data.error || 'Não foi possível atualizar'}`);
    }
  } catch (error) {
    console.error('Erro:', error);
    alert('❌ Erro ao conectar com o servidor.');
  }
}

async function excluirMaterial(materialId: number, materialNome: string): Promise<void> {
  // Preencher modal
  (document.getElementById('deleteMaterialId') as HTMLInputElement).value = materialId.toString();
  (document.getElementById('deleteMaterialNome') as HTMLElement).textContent = materialNome;

  // Abrir modal
  const modal = new (window as any).bootstrap.Modal(document.getElementById('modalExcluirMaterial'));
  modal.show();
}

async function confirmarExclusaoMaterial(): Promise<void> {
  const materialId = parseInt((document.getElementById('deleteMaterialId') as HTMLInputElement).value);

  try {
    const response = await fetch(`/api/materials/${materialId}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      // Fechar modal
      const modal = (window as any).bootstrap.Modal.getInstance(document.getElementById('modalExcluirMaterial'));
      modal.hide();
      
      alert('✅ Material excluído com sucesso!');
      await loadData();
    } else {
      alert(`❌ Erro: ${data.error || 'Não foi possível excluir'}`);
    }
  } catch (error) {
    console.error('Erro:', error);
    alert('❌ Erro ao conectar com o servidor.');
  }
}

// Expor funções globalmente para o onclick
(window as any).salvarConfigMaterial = salvarConfigMaterial;
(window as any).salvarTodasConfigs = salvarTodasConfigs;
(window as any).clearFilters = clearFilters;
(window as any).editarMaterial = editarMaterial;
(window as any).excluirMaterial = excluirMaterial;
(window as any).salvarEdicaoMaterial = salvarEdicaoMaterial;
(window as any).confirmarExclusaoMaterial = confirmarExclusaoMaterial;

async function init(): Promise<void> {
  const form = document.getElementById('stockForm');
  if (form) {
    form.addEventListener('submit', submitStock);
  }

  // Setup sidebar navigation
  setupSidebarNavigation();
  
  // Setup filters
  setupFilters();

  await loadData();
}

init();
