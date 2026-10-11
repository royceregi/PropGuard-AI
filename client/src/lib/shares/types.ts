export interface PropertyShareData {
  share_id: string;
  property_id: string;
  owner_user_id: string;
  buyer_user_id: string;
  notes: string | null;
  created_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
  property: {
    property_id: string;
    property_name: string | null;
    address: string | null;
    city: string | null;
    district: string | null;
    title_deed_number: string | null;
  } | null;
  owner: {
    user_id: string;
    name: string;
    email: string | null;
  } | null;
  buyer: {
    user_id: string;
    name: string;
    email: string | null;
  } | null;
}

export interface CreateSharePayload {
  buyer_user_id: string;
  notes?: string;
  expires_in_days?: number;
}

export type PropertyShareItem = PropertyShareData;

export type LinkReason = "PREVIOUS_OWNER" | "TRANSACTION_PARTY";

export interface LinkedPropertyItem {
  property_id: string;
  property: PropertyShareData["property"];
  reasons: LinkReason[];
}

export const LINK_REASON_LABELS: Record<LinkReason, string> = {
  PREVIOUS_OWNER: "Previous owner",
  TRANSACTION_PARTY: "Transaction party"
};
