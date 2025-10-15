export interface MindBodySiteInfo {
  Sites: Site[];
}

export interface Site {
  AcceptsVisa: boolean;
  AcceptsMasterCard: boolean;
  AcceptsAmericanExpress: boolean;
  AcceptsDiscover: boolean;
  AcceptsACH: boolean;
  SiteID: number;
  Name: string;
  Description: string;
  LogoURL: string;
  PageColor1: string;
  PageColor2: string;
  PageColor3: string;
  PageColor4: string;
  AcceptsVisa1: boolean;
  AcceptsMasterCard1: boolean;
  AcceptsAmericanExpress1: boolean;
  AcceptsDiscover1: boolean;
  AcceptsACH1: boolean;
  ContactEmail: string;
  ESA: boolean;
  TotalWOD: boolean;
  TaxInclusivePrices: boolean;
  SMSPackageEnabled: boolean;
  AllowsDashboardAccess: boolean;
  PricingLevel: string;
  HasClasses: boolean;
  HasEnrollments: boolean;
  HasRetail: boolean;
  HasServices: boolean;
  HasContracts: boolean;
  HasMemberships: boolean;
  HasPackages: boolean;
  HasResources: boolean;
  HasCommunity: boolean;
  HasArrivals: boolean;
  HasCancelations: boolean;
  HasUserAccountAccess: boolean;
  HasMobileAccess: boolean;
}

export interface MindBodyCredentialResponse {
  success: boolean;
  sites?: MindBodySiteInfo;
  error?: string;
}
