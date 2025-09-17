/**
 * Defines the structure of the JSON response from the backend's stream endpoints
 * when a redirect URL or an error is returned.
 */
export interface StreamApiResponse{
    success:boolean;
    message:string;
    code:number;
    data:any;
    errors?:string[];
}

