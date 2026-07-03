import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import extractRouter from "./extract.js";
import proxyRouter from "./proxy.js";
import zipRouter from "./zip.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(extractRouter);
router.use(proxyRouter);
router.use(zipRouter);

export default router;
