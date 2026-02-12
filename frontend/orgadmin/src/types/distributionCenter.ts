export interface DistributionCenter {
  id: string;
  name: string;
  address: string;
  socketPath?: string;
  createdAt: string;
}

export interface CreateDistributionCenterInput {
  name: string;
  address: string;
}

export interface UpdateDistributionCenterInput {
  name: string;
  address: string;
}
