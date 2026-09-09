// Product catalog used to classify HubSpot line items as ARR vs non-ARR.
//
// SOURCE OF TRUTH: cashflow-qbo/data/product_classification_v2.csv (Finance).
// Generated 2026-09-09 by scripts/generate-product-catalog.py — rerun it when
// Finance updates the catalog so the dashboard's ARR keeps matching Finance's numbers.
// Do not hand-edit.

export interface ProductClassification {
  productId: string
  sku: string
  itemName: string
  countsTowardArr: boolean
  revenueType: string
}

export const PRODUCT_CLASSIFICATION: ProductClassification[] = [
  { productId: "1", sku: "SALES", itemName: "Sales", countsTowardArr: false, revenueType: "Service" },
  { productId: "1010000001", sku: "SAAS-OVERGRAD-FOR-CBOS", itemName: "SaaS:Overgrad for CBOs", countsTowardArr: true, revenueType: "License" },
  { productId: "17035992892", sku: "CBO", itemName: "SaaS:Overgrad for CBOs", countsTowardArr: true, revenueType: "License" },
  { productId: "1010000021", sku: "IMPL-TWILIO-SETUP-AND-IMP", itemName: "Training and Implementation:Twilio Setup and Implementation Fee", countsTowardArr: false, revenueType: "Service" },
  { productId: "3310744170", sku: "Twilio", itemName: "Training and Implementation:Twilio Setup and Implementation Fee", countsTowardArr: false, revenueType: "Service" },
  { productId: "1010000022", sku: "STU-OVERGRAD-FOR-MIDDLE-", itemName: "Student Licenses:Overgrad for Middle School", countsTowardArr: true, revenueType: "License" },
  { productId: "2280658270", sku: "MiddleSchool", itemName: "Student Licenses:Overgrad for Middle School", countsTowardArr: true, revenueType: "License" },
  { productId: "1010000023", sku: "STU-SUCCESS-DATA-ONLY-AD", itemName: "Student Licenses:Success Data-Only Add On", countsTowardArr: true, revenueType: "License" },
  { productId: "2280664981", sku: "SuccessData", itemName: "Student Licenses:Success Data-Only Add On", countsTowardArr: true, revenueType: "License" },
  { productId: "1010000051", sku: "STU-OVERGRAD-FOR-ELEMENT", itemName: "Student Licenses:Overgrad for Elementary", countsTowardArr: true, revenueType: "License" },
  { productId: "19385592650", sku: "Elementary", itemName: "Student Licenses:Overgrad for Elementary", countsTowardArr: true, revenueType: "License" },
  { productId: "1010000053", sku: "IMPL-ON-SITE-TRAINING-&-C", itemName: "Training and Implementation:On-Site Training & Consulting", countsTowardArr: false, revenueType: "Service" },
  { productId: "19385592683", sku: "OnSiteTraining", itemName: "Training and Implementation:On-Site Training & Consulting", countsTowardArr: false, revenueType: "Service" },
  { productId: "11", sku: "STU-ACCESS", itemName: "Student Licenses:Access", countsTowardArr: true, revenueType: "License" },
  { productId: "2280664974", sku: "Access", itemName: "Student Licenses:Access", countsTowardArr: true, revenueType: "License" },
  { productId: "19", sku: "IMPL-PROJECT-MANAGEMENT", itemName: "Training and Implementation:Project Management", countsTowardArr: false, revenueType: "Service" },
  { productId: "21", sku: "SAAS-NSC-REPORT", itemName: "SaaS:NSC Report", countsTowardArr: true, revenueType: "License" },
  { productId: "2280658272", sku: "NSC", itemName: "SaaS:NSC Report", countsTowardArr: true, revenueType: "License" },
  { productId: "35", sku: "DEV-CUSTOM-DEVELOPMENT", itemName: "Custom Development:Custom Development", countsTowardArr: false, revenueType: "Service" },
  { productId: "2922059794", sku: "CustomDev", itemName: "Custom Development:Custom Development", countsTowardArr: false, revenueType: "Service" },
  { productId: "37", sku: "FEE-CONTRACTING-FEE", itemName: "Third Party Services:Contracting Fee", countsTowardArr: false, revenueType: "Service" },
  { productId: "38", sku: "FEE-CREDIT-CARD-FEE", itemName: "Third Party Services:Credit Card Fee", countsTowardArr: false, revenueType: "Service" },
  { productId: "41", sku: "SAAS-OVERGRAD-DASHBOARD", itemName: "SaaS:Overgrad Dashboard", countsTowardArr: true, revenueType: "License" },
  { productId: "19385654544", sku: "Dashboard", itemName: "SaaS:Overgrad Dashboard", countsTowardArr: true, revenueType: "License" },
  { productId: "42", sku: "STU-ALUMNI-DASHBOARD-(DE", itemName: "Student Licenses:Alumni Dashboard (deleted)", countsTowardArr: true, revenueType: "License" },
  { productId: "44", sku: "ALUMNI-REPORTING-ADD", itemName: "Alumni Reporting Add On", countsTowardArr: true, revenueType: "License" },
  { productId: "45", sku: "STU-SUCCESS", itemName: "Student Licenses:Success", countsTowardArr: true, revenueType: "License" },
  { productId: "2280658274", sku: "Success", itemName: "Student Licenses:Success", countsTowardArr: true, revenueType: "License" },
  { productId: "9", sku: "IMPL-IMPLEMENTATION-AND-D", itemName: "Training and Implementation:Implementation and Data Migration Services", countsTowardArr: false, revenueType: "Service" },
  { productId: "2378251780", sku: "ImplementationAndMigration", itemName: "Training and Implementation:Implementation and Data Migration Services", countsTowardArr: false, revenueType: "Service" },
  { productId: "100", sku: "REIMB-001", itemName: "Reimbursement", countsTowardArr: false, revenueType: "Service" },
  { productId: "19406581040", sku: "Reimbursement", itemName: "Reimbursement", countsTowardArr: false, revenueType: "Service" },
  { productId: "2742697564", sku: "Grant", itemName: "Grant", countsTowardArr: false, revenueType: "Service" },
  { productId: "1010000060", sku: "nXu_912", itemName: "Student Licenses:nXu 9-12 Curriculum", countsTowardArr: true, revenueType: "License" },
  { productId: "34600089386", sku: "nXu", itemName: "Student Licenses:nXu 9-12 Curriculum", countsTowardArr: true, revenueType: "License" },
  { productId: "42666933774", sku: "MiddleSchoolNxu", itemName: "Student Licenses:nXu 6-8 Curriculum", countsTowardArr: true, revenueType: "License" },
  { productId: "42729622027", sku: "ElementarySchoolNxu", itemName: "Student Licenses:nXu K-5 Curriculum", countsTowardArr: true, revenueType: "License" },
  { productId: "41213684366", sku: "Complete", itemName: "Student Licenses:Complete", countsTowardArr: true, revenueType: "License" },
  { productId: "41191595036", sku: "nXuOnboarding", itemName: "Training and Implementation:nXu Curriculum Onboarding", countsTowardArr: false, revenueType: "Service" },
  { productId: "19406581091", sku: "Curriculum", itemName: "Student Licenses:Curriculum", countsTowardArr: true, revenueType: "License" },
  { productId: "19690410809", sku: "TextMessaging", itemName: "Student Licenses:Text Messaging Add On", countsTowardArr: true, revenueType: "License" },
  { productId: "19406581079", sku: "Travel", itemName: "Reimbursement:Travel", countsTowardArr: false, revenueType: "Service" },
  { productId: "47054306434", sku: "SiteLicenseBand1", itemName: "Site License \u2014 Band 1 (Sites 1\u2013100)", countsTowardArr: true, revenueType: "License" },
  { productId: "47062303765", sku: "SiteLicenseBand2", itemName: "Site License \u2014 Band 2 (Sites 101\u2013200)", countsTowardArr: true, revenueType: "License" },
  { productId: "47053067873", sku: "SiteLicenseBand3", itemName: "Site License \u2014 Band 3 (Sites 201\u2013300)", countsTowardArr: true, revenueType: "License" },
  { productId: "47053687092", sku: "SiteLicenseBand4", itemName: "Site License \u2014 Band 4 (Sites 301\u2013400)", countsTowardArr: true, revenueType: "License" },
  { productId: "47061219899", sku: "MiddleSchoolSite", itemName: "Middle School Site License (6\u20138)", countsTowardArr: true, revenueType: "License" },
  { productId: "47058453815", sku: "HelpDeskSupport", itemName: "Help Desk Support (per quarter)", countsTowardArr: true, revenueType: "License" },
  { productId: "47041288483", sku: "OngoingMaintenance", itemName: "Ongoing Maintenance (per quarter)", countsTowardArr: true, revenueType: "License" },
  { productId: "47047396240", sku: "ScaleUpServices", itemName: "Scale-up Services (per student)", countsTowardArr: true, revenueType: "License" },
  { productId: "47062614026", sku: "SystemImplementation", itemName: "System Implementation", countsTowardArr: false, revenueType: "Service" },
  { productId: "47044135503", sku: "TrainingPerHour", itemName: "Training (per hour)", countsTowardArr: false, revenueType: "Service" },
]
