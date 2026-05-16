export interface IMenu {
  id: string;
  name: string;
  code: string;
  route?: string | null;
  icon?: string | null;
  displayOrder: number;
  children: IMenu[];
}
