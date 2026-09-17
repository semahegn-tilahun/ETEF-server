import { Router } from "express";
import { requireAuth, requireCsrf } from "../auth.js";
import * as c from "../controllers/cmsController.js";

const router = Router();
const admin = [requireAuth, requireCsrf];

router.get("/faqs", c.publicFaqs);
router.get("/vacancies", c.publicVacancies);
router.get("/news", c.publicNews);
router.get("/gallery/albums", c.publicAlbums);
router.get("/settings", c.publicSettings);
router.get("/content", c.publicContent);
router.post("/membership/applications", c.submitMembership);

router.get("/admin/faqs", requireAuth, c.adminFaqs);
router.post("/admin/faqs", ...admin, c.createFaq);
router.patch("/admin/faqs/:id", ...admin, c.updateFaq);
router.delete("/admin/faqs/:id", ...admin, c.deleteFaq);

router.get("/admin/vacancies", requireAuth, c.adminVacancies);
router.get("/admin/news", requireAuth, c.adminNews);
router.post("/admin/news", ...admin, c.createNews);
router.patch("/admin/news/:id", ...admin, c.updateNews);
router.delete("/admin/news/:id", ...admin, c.deleteNews);
router.post("/admin/vacancies", ...admin, c.createVacancy);
router.patch("/admin/vacancies/:id", ...admin, c.updateVacancy);
router.delete("/admin/vacancies/:id", ...admin, c.deleteVacancy);

router.get("/admin/gallery/albums", requireAuth, c.adminAlbums);
router.post("/admin/gallery/albums", ...admin, c.createAlbum);
router.patch("/admin/gallery/albums/:id", ...admin, c.updateAlbum);


router.get("/admin/settings", requireAuth, c.adminSettings);
router.get("/admin/content", requireAuth, c.adminContent);
router.patch("/admin/content/:key", ...admin, c.updateContent);
router.put("/admin/settings", ...admin, c.updateSettings);

router.get("/admin/applications", requireAuth, c.listApplications);
router.get("/admin/application-stats", requireAuth, c.applicationStats);
router.patch("/admin/applications/:id", ...admin, c.updateApplication);
export default router;
