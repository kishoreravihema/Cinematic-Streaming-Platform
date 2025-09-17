export interface BaseResponse<T>{
    success:boolean;
    message:string;
    code:number;
    data:T;
    errors?:string[];
    
}