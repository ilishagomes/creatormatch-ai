import { BrowserRouter, Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { ButtonLink, EmptyState } from "./components/ui";
import { CampaignBuilderPage } from "./pages/CampaignBuilderPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { CreatorDetailsPage } from "./pages/CreatorDetailsPage";
import { CreatorsPage } from "./pages/CreatorsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DiscoveryPage } from "./pages/DiscoveryPage";
import { DraftsPage } from "./pages/DraftsPage";
import { OutreachStudioPage } from "./pages/OutreachStudioPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="campaigns/new" element={<CampaignBuilderPage />} />
          <Route path="campaigns/:id" element={<DiscoveryPage />} />
          <Route path="creators" element={<CreatorsPage />} />
          <Route path="creators/:creatorId" element={<CreatorDetailsPage />} />
          <Route path="outreach" element={<DraftsPage />} />
          <Route path="outreach/new" element={<OutreachStudioPage />} />
          <Route path="outreach/:draftId" element={<OutreachStudioPage />} />
          <Route path="*" element={<EmptyState icon="search" title="Page not found" description="That page doesn't exist." action={<ButtonLink to="/">Back to dashboard</ButtonLink>} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
