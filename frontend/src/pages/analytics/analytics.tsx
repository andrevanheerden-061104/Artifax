import React, { useEffect, useState } from 'react';
import '../crafting/crafting.css';
import AlertStrip from '../../components/layout/AlertStrip';
import PageHeader from '../../components/layout/PageHeader';
import ProductionActivity from './components/insights/ProductionActivity';
import MostCrafted from './components/mostCarfted/mostCarfted';
import { AnalyticsKpis, MaterialForecast } from './components/insights/AnalyticsInsights';
import { useAnalyticsData } from './components/insights/useAnalyticsData';
import './analytics.css';
import { getInventoryOverview, LowStockEntry } from '../../services/inventoryApi';
import { getCurrentDateSAST } from '../../Date/dateUtils';

const AnalyticsPage: React.FC = () => {
  const currentDate = getCurrentDateSAST();
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockEntry[]>([]);
  const data = useAnalyticsData();

  useEffect(() => {
    getInventoryOverview()
      .then((overview) => setLowStockAlerts(overview.lowStock))
      .catch((error) => console.error('Failed to load analytics low stock alerts', error));
  }, []);

  return (
    <div className="page-content">
      <div className="space-y-4 sm:space-y-5">
        <PageHeader title="Analytics" subtitle={`Production insights · ${currentDate}`} />
        <AlertStrip items={lowStockAlerts} />

        <AnalyticsKpis data={data} />

        <div className="analytics-grid">
          <ProductionActivity data={data} />
          <MostCrafted orders={data.orders} blueprints={data.blueprints} loading={data.loading} />
        </div>

        <MaterialForecast data={data} />
      </div>
    </div>
  );
};

export default AnalyticsPage;
